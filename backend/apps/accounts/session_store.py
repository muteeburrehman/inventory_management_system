"""Redis-backed refresh session allowlist and short-lived access-token revocation."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.conf import settings

if TYPE_CHECKING:
    from redis import Redis

logger = logging.getLogger(__name__)

_redis: Redis | None = None


def _client():
    global _redis
    url = getattr(settings, "REDIS_URL", "") or ""
    if not url:
        return None
    if _redis is None:
        try:
            import redis

            _redis = redis.Redis.from_url(url, decode_responses=True)
            _redis.ping()
        except Exception as exc:
            logger.warning("Redis unavailable (%s); session controls disabled.", exc)
            _redis = None
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
    return r.zscore(_uid_key(user_id), jti) is not None


def add_refresh_session(user_id, jti: str | None) -> None:
    if not jti:
        return
    r = _client()
    if not r:
        return
    import time

    key = _uid_key(user_id)
    r.zadd(key, {jti: time.time() * 1000})
    ttl = int(getattr(settings, "REFRESH_TOKEN_LIFETIME_SEC", 604800))
    r.expire(key, ttl + 60)
    _enforce_max_sessions(user_id)


def remove_refresh_session(user_id, jti: str | None) -> None:
    if not jti:
        return
    r = _client()
    if not r:
        return
    r.zrem(_uid_key(user_id), jti)


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
    r.delete(_uid_key(user_id))


def block_access_jti(jti: str | None, ttl_seconds: int) -> None:
    if not jti or ttl_seconds <= 0:
        return
    r = _client()
    if not r:
        return
    r.setex(_block_key(jti), ttl_seconds, "1")


def access_jti_blocked(jti: str | None) -> bool:
    if not jti:
        return False
    r = _client()
    if not r:
        return False
    return bool(r.exists(_block_key(jti)))


def forgot_password_rate_allow(identifier: str, max_attempts: int = 5, window_sec: int = 3600) -> bool:
    r = _client()
    if not r:
        return True
    key = f"ims:pwdreq:{identifier}"
    n = r.incr(key)
    if n == 1:
        r.expire(key, window_sec)
    return n <= max_attempts


def _enforce_max_sessions(user_id) -> None:
    max_s = int(getattr(settings, "MAX_ACTIVE_REFRESH_SESSIONS", 10))
    if max_s <= 0:
        return
    r = _client()
    if not r:
        return
    key = _uid_key(user_id)
    n = r.zcard(key)
    if n <= max_s:
        return
    # Remove oldest sessions (lowest score)
    trim = n - max_s
    old = r.zrange(key, 0, trim - 1)
    if old:
        r.zrem(key, *old)
