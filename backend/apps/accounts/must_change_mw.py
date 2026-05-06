from django.http import JsonResponse


class MustChangePasswordMiddleware:
    """Block API usage until the user sets a new password (e.g. after accepting an invite)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return self.get_response(request)
        if not getattr(user, "must_change_password", False):
            return self.get_response(request)
        if (
            path.startswith("/api/v1/auth/")
            or path.startswith("/admin/")
            or path.startswith("/static/")
            or path.startswith("/media/")
        ):
            return self.get_response(request)
        if path.startswith("/api/v1/"):
            return JsonResponse(
                {
                    "success": False,
                    "data": {},
                    "message": "You must change your password before continuing.",
                },
                status=403,
            )
        return self.get_response(request)
