from rest_framework import permissions

from apps.accounts.models import User


def can_manage_branches(user) -> bool:
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    role = getattr(user, "role", None)
    return role in (
        User.Role.SUPER_ADMIN,
        User.Role.OWNER,
        User.Role.MANAGER,
    )


class CanViewBranches(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class CanManageBranches(permissions.BasePermission):
    message = "Only super admin, owner, or manager can change branches."

    def has_permission(self, request, view):
        return can_manage_branches(request.user)
