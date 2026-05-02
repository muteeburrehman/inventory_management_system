from django.conf import settings
from django.db import models


class LedgerEntry(models.Model):
    class LedgerType(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        SUPPLIER = "supplier", "Supplier"
        CASH = "cash", "Cash"
        BANK = "bank", "Bank"
        EXPENSE = "expense", "Expense"
        SALES = "sales", "Sales"
        PURCHASE = "purchase", "Purchase"

    ledger_type = models.CharField(max_length=20, choices=LedgerType.choices)
    reference_id = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)
    debit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reference_number = models.CharField(max_length=64, blank=True)
    entry_date = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    branch = models.ForeignKey(
        "settings_app.Branch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )

    class Meta:
        ordering = ["-entry_date", "-id"]
