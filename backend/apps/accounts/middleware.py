import json

from django.http.request import RawPostDataException
from django.utils.deprecation import MiddlewareMixin

from .models import AuditLog


class AuditLogMiddleware(MiddlewareMixin):
    """Log mutating HTTP requests for audit trail."""

    LOG_METHODS = ("POST", "PUT", "PATCH", "DELETE")

    def process_response(self, request, response):
        if request.method not in self.LOG_METHODS:
            return response
        if not getattr(request, "user", None) or not request.user.is_authenticated:
            return response
        path = request.path
        if "/admin/" in path or path.startswith("/static/") or path.startswith("/media/"):
            return response
        action = request.method
        module = "api"
        if "/api/v1/" in path:
            parts = [p for p in path.split("/") if p]
            if len(parts) > 2:
                module = parts[2]
        desc = f"{action} {path}"
        if request.method in ("POST", "PUT", "PATCH") and request.content_type == "application/json":
            # DRF may have already parsed the body; reading request.body again raises RawPostDataException.
            try:
                raw = request.body
            except RawPostDataException:
                raw = b"{}"
            try:
                body = json.loads(raw.decode("utf-8") or "{}")
                if isinstance(body, dict):
                    desc = f"{desc} keys={list(body.keys())[:20]}"
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass
        ip = self._client_ip(request)
        AuditLog.objects.create(
            user=request.user,
            action=action,
            module=module,
            description=desc[:2000],
            ip_address=ip,
        )
        return response

    @staticmethod
    def _client_ip(request):
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")
