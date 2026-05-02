from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        CASHIER = "cashier", "Cashier"
        ACCOUNTANT = "accountant", "Accountant"
        INVENTORY_STAFF = "inventory_staff", "Inventory Staff"

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

    class Meta:
        ordering = ["username", "id"]


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
