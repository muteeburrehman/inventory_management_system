from django.conf import settings
from django.db import models

from apps.settings_app.models import Branch


class ExpenseCategory(models.Model):
    name = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.name


class Expense(models.Model):
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name="expenses")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(blank=True)
    date = models.DateField()
    payment_mode = models.CharField(max_length=32, default="cash")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="expenses")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )

    class Meta:
        ordering = ["-date", "-id"]
