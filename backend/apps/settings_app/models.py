from django.conf import settings
from django.db import models


class Branch(models.Model):
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(
        max_length=32,
        blank=True,
        help_text="Optional internal store or location code.",
    )
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    contact_name = models.CharField(max_length=255, blank=True, help_text="Primary store contact person.")
    is_main = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_branches",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class BusinessSettings(models.Model):
    branch = models.OneToOneField(
        Branch,
        on_delete=models.CASCADE,
        related_name="business_settings",
    )
    business_name = models.CharField(max_length=255)
    logo = models.ImageField(upload_to="logos/", blank=True, null=True)
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default="PKR")
    invoice_template = models.CharField(max_length=50, default="standard")
    receipt_template = models.CharField(max_length=50, default="thermal")
    loyalty_points_per_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.business_name} ({self.branch_id})"


class ShiftClosing(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="shift_closings")
    cashier = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="shift_closings",
    )
    opening_cash = models.DecimalField(max_digits=12, decimal_places=2)
    closing_cash = models.DecimalField(max_digits=12, decimal_places=2)
    total_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_expenses = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cash_difference = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shift_start = models.DateTimeField()
    shift_end = models.DateTimeField(blank=True, null=True)
    is_open = models.BooleanField(default=True)

    class Meta:
        ordering = ["-shift_start"]


class DocumentNumberSequence(models.Model):
    """Sequential invoice numbers per branch, year, and document type (INV / PUR)."""

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="doc_sequences")
    year = models.PositiveIntegerField()
    document_type = models.CharField(max_length=10)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "year", "document_type"],
                name="unique_branch_year_doctype",
            )
        ]
