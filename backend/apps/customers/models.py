from django.db import models


class Customer(models.Model):
    """Customer master data. Visible on a branch only when linked via ``branches``."""

    class CustomerType(models.TextChoices):
        RETAIL = "retail", "Retail"
        WHOLESALE = "wholesale", "Wholesale"
        VIP = "vip", "VIP"

    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    customer_type = models.CharField(
        max_length=20,
        choices=CustomerType.choices,
        default=CustomerType.RETAIL,
    )
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reward_points = models.PositiveIntegerField(default=0)
    branches = models.ManyToManyField(
        "settings_app.Branch",
        blank=True,
        related_name="customers",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
