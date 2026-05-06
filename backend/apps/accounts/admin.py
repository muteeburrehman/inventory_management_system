from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import AuditLog, PasswordResetToken, Permission, User, UserBranchAccess, UserInvitation


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "role", "branch", "is_staff")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Extra", {"fields": ("role", "branch", "phone", "must_change_password")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Extra", {"fields": ("role", "branch", "phone", "must_change_password")}),
    )


@admin.register(UserBranchAccess)
class UserBranchAccessAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "branch")


@admin.register(UserInvitation)
class UserInvitationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "expires_at", "used_at", "created_by")
    raw_id_fields = ("user", "created_by")


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "expires_at", "created_at")
    raw_id_fields = ("user",)


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "module", "can_create", "can_edit", "can_delete", "can_refund")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "action", "module", "timestamp")
