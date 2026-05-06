from rest_framework import permissions

from apps.accounts.models import Permission, User


def _is_privileged(user) -> bool:
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    role = getattr(user, "role", None)
    return role in (User.Role.SUPER_ADMIN, User.Role.OWNER)


def is_privileged_user(user) -> bool:
    return _is_privileged(user)


class CanManageUsers(permissions.BasePermission):
    message = "Only super admin or owner can manage staff and invitations."

    def has_permission(self, request, view):
        return _is_privileged(request.user)


class CanManageUsersOrViewSelf(permissions.BasePermission):
    """
    List/create/update/delete: privileged only.
    Retrieve: privileged or same user.
    """

    message = "You do not have permission to view or manage this account."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if view.action in ("retrieve", "list"):
            return True
        return _is_privileged(request.user)

    def has_object_permission(self, request, view, obj):
        if view.action in ("update", "partial_update", "destroy"):
            return _is_privileged(request.user)
        if view.action == "retrieve":
            return _is_privileged(request.user) or obj.pk == request.user.pk
        return True


class CanRefund(permissions.BasePermission):
    message = "You do not have permission to process refunds."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        role = getattr(user, "role", None)
        if role in (User.Role.SUPER_ADMIN, User.Role.OWNER):
            return True
        role_str = getattr(user, "role", "")
        return Permission.objects.filter(role=role_str, module="sales", can_refund=True).exists()
