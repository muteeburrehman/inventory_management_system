"""Redis-backed refresh session allowlist and short-lived access-token revocation."""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

from django.conf import settings

if TYPE_CHECKING:
    from redis import Redis

logger = logging.getLogger(__name__)

_redis: Redis | None = None
# When Redis is down, avoid reconnecting on every HTTP request (noise + overhead).
_redis_retry_after_monotonic: float = 0.0
_REDIS_RETRY_INTERVAL_SEC = 60.0


def _invalidate_redis_client() -> None:
    """Drop cached client after errors so the next call reconnects."""
    global _redis, _redis_retry_after_monotonic
    _redis = None
    _redis_retry_after_monotonic = 0.0


def _client():
    global _redis, _redis_retry_after_monotonic
    url = getattr(settings, "REDIS_URL", "") or ""
    if not url:
        return None
    now = time.monotonic()
    if _redis is None and now < _redis_retry_after_monotonic:
        return None
    if _redis is None:
        try:
            import redis

            _redis = redis.Redis.from_url(url, decode_responses=True)
            _redis.ping()
            _redis_retry_after_monotonic = 0.0
        except Exception as exc:
            _redis = None
            _redis_retry_after_monotonic = now + _REDIS_RETRY_INTERVAL_SEC
            logger.warning(
                "Redis unavailable (%s); session controls disabled for ~%ds. "
                "Unset REDIS_URL in .env if you are not using Redis, or start Redis at this URL.",
                exc,
                int(_REDIS_RETRY_INTERVAL_SEC),
            )
    return _redis


def _uid_key(user_id) -> str:
    return f"ims:sessions:{user_id!s}"


def _block_key(jti: str) -> str:
    return f"ims:blocked_jti:{jti}"


def refresh_allowed(user_id, jti: str | None) -> bool:
    if not jti:
        return False
    r = _client()
    if not r:
        return True
    try:
        return r.zscore(_uid_key(user_id), jti) is not None
    except Exception as exc:
        logger.warning("Redis error in refresh_allowed (%s); session controls disabled.", exc)
        _invalidate_redis_client()
        return True


def add_refresh_session(user_id, jti: str | None) -> None:
    if not jti:
        return
    r = _client()
    if not r:
        return
    import time

    key = _uid_key(user_id)
    try:
        r.zadd(key, {jti: time.time() * 1000})
        ttl = int(getattr(settings, "REFRESH_TOKEN_LIFETIME_SEC", 604800))
        r.expire(key, ttl + 60)
        _enforce_max_sessions(user_id)
    except Exception as exc:
        logger.warning("Redis error in add_refresh_session (%s); session controls disabled.", exc)
        _invalidate_redis_client()


def remove_refresh_session(user_id, jti: str | None) -> None:
    if not jti:
        return
    r = _client()
    if not r:
        return
    try:
        r.zrem(_uid_key(user_id), jti)
    except Exception as exc:
        logger.warning("Redis error in remove_refresh_session (%s); session controls disabled.", exc)
        _invalidate_redis_client()


def rotate_refresh_session(user_id, old_jti: str | None, new_jti: str | None) -> None:
    if not new_jti:
        return
    r = _client()
    if not r:
        return
    remove_refresh_session(user_id, old_jti)
    add_refresh_session(user_id, new_jti)


def clear_refresh_sessions(user_id) -> None:
    r = _client()
    if not r:
        return
    try:
        r.delete(_uid_key(user_id))
    except Exception as exc:
        logger.warning("Redis error in clear_refresh_sessions (%s); session controls disabled.", exc)
        _invalidate_redis_client()


def block_access_jti(jti: str | None, ttl_seconds: int) -> None:
    if not jti or ttl_seconds <= 0:
        return
    r = _client()
    if not r:
        return
    try:
        r.setex(_block_key(jti), ttl_seconds, "1")
    except Exception as exc:
        logger.warning("Redis error in block_access_jti (%s); session controls disabled.", exc)
        _invalidate_redis_client()


def access_jti_blocked(jti: str | None) -> bool:
    if not jti:
        return False
    r = _client()
    if not r:
        return False
    try:
        return bool(r.exists(_block_key(jti)))
    except Exception as exc:
        logger.debug(
            "Redis error in access_jti_blocked (%s); treating token as not blocked.",
            exc,
        )
        _invalidate_redis_client()
        return False


def forgot_password_rate_allow(identifier: str, max_attempts: int = 5, window_sec: int = 3600) -> bool:
    r = _client()
    if not r:
        return True
    key = f"ims:pwdreq:{identifier}"
    try:
        n = r.incr(key)
        if n == 1:
            r.expire(key, window_sec)
        return n <= max_attempts
    except Exception as exc:
        logger.warning("Redis error in forgot_password_rate_allow (%s); allowing request.", exc)
        _invalidate_redis_client()
        return True


def _enforce_max_sessions(user_id) -> None:
    max_s = int(getattr(settings, "MAX_ACTIVE_REFRESH_SESSIONS", 10))
    if max_s <= 0:
        return
    r = _client()
    if not r:
        return
    key = _uid_key(user_id)
    try:
        n = r.zcard(key)
        if n <= max_s:
            return
        trim = n - max_s
        old = r.zrange(key, 0, trim - 1)
        if old:
            r.zrem(key, *old)
    except Exception as exc:
        logger.warning("Redis error in _enforce_max_sessions (%s); session controls disabled.", exc)
        _invalidate_redis_client()
