from django.db import models


class Supplier(models.Model):
    """Vendor master data. Visible on a branch only when linked via ``branches``."""

    name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    contact_person = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    tax_number = models.CharField(max_length=64, blank=True)
    payment_terms = models.TextField(
        blank=True,
        help_text="e.g. Net 30, COD, partial advance.",
    )
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    branches = models.ManyToManyField(
        "settings_app.Branch",
        blank=True,
        related_name="suppliers",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
