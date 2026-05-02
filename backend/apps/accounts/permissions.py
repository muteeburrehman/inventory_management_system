from rest_framework import permissions

from apps.accounts.models import Permission, User


class CanRefund(permissions.BasePermission):
    message = "You do not have permission to process refunds."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "role", None) == User.Role.ADMIN:
            return True
        role = getattr(user, "role", "")
        return Permission.objects.filter(role=role, module="sales", can_refund=True).exists()
