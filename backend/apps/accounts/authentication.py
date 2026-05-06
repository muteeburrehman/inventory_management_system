from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from apps.accounts import session_store


class IMSJWTAuthentication(JWTAuthentication):
    """JWT auth that honors short-lived access JTI blocks (logout / revocation)."""

    def get_validated_token(self, raw_token):
        token = super().get_validated_token(raw_token)
        jti = token.get("jti")
        if session_store.access_jti_blocked(jti):
            raise InvalidToken({"detail": "Token is invalid or expired", "code": "token_not_valid"})
        return token
