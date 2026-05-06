import hashlib
import secrets

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = "super_admin", "Super Admin"
        OWNER = "owner", "Owner"
        MANAGER = "manager", "Manager"
        CASHIER = "cashier", "Cashier"
        INVENTORY_MANAGER = "inventory_manager", "Inventory Manager"
        ACCOUNTANT = "accountant", "Accountant"
        SALES_STAFF = "sales_staff", "Sales Staff"

    role = models.CharField(
        max_length=32,
        choices=Role.choices,
        default=Role.CASHIER,
    )
    branch = models.ForeignKey(
        "settings_app.Branch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )
    phone = models.CharField(max_length=50, blank=True)
    must_change_password = models.BooleanField(default=False)

    class Meta:
        ordering = ["username", "id"]


class UserBranchAccess(models.Model):
    """Which branches a user may work in (picker, reporting scope, me/branch updates)."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="branch_accesses",
    )
    branch = models.ForeignKey(
        "settings_app.Branch",
        on_delete=models.CASCADE,
        related_name="user_accesses",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "branch"], name="accounts_userbranchaccess_unique"),
        ]


class UserInvitation(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    token_hash = models.CharField(max_length=64, db_index=True)
    expires_at = models.DateTimeField()
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invitations_sent",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    @staticmethod
    def hash_token(raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    @classmethod
    def create_with_token(cls, *, user, created_by, hours_valid: int = 72):
        raw = secrets.token_urlsafe(48)
        return raw, cls.objects.create(
            user=user,
            token_hash=cls.hash_token(raw),
            expires_at=timezone.now() + timezone.timedelta(hours=hours_valid),
            created_by=created_by,
        )

    def is_valid(self) -> bool:
        return self.used_at is None and timezone.now() <= self.expires_at

    def mark_used(self):
        self.used_at = timezone.now()
        self.save(update_fields=["used_at"])


class PasswordResetToken(models.Model):
    """Single-use password reset; stored hashed (same scheme as invitations)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token_hash = models.CharField(max_length=64, db_index=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def issue(cls, user):
        raw = secrets.token_urlsafe(32)
        cls.objects.filter(user=user).delete()
        cls.objects.create(
            user=user,
            token_hash=UserInvitation.hash_token(raw),
            expires_at=timezone.now() + timezone.timedelta(hours=1),
        )
        return raw


class Permission(models.Model):
    role = models.CharField(max_length=32)
    module = models.CharField(max_length=64)
    can_create = models.BooleanField(default=True)
    can_edit = models.BooleanField(default=True)
    can_delete = models.BooleanField(default=False)
    can_print = models.BooleanField(default=True)
    can_refund = models.BooleanField(default=False)
    can_view_reports = models.BooleanField(default=False)

    class Meta:
        unique_together = [["role", "module"]]

    def __str__(self):
        return f"{self.role} / {self.module}"


class AuditLog(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=64)
    module = models.CharField(max_length=64)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
