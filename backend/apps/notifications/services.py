"""Create operational alerts when users open the notifications list."""

from decimal import Decimal

from django.db.models import F

from apps.customers.models import Customer

from .models import Notification


def ensure_due_payment_alerts():
    """Idempotently create payment-due alerts for customers with balance > 0."""
    customers = Customer.objects.filter(current_balance__gt=Decimal("0"))[:50]
    for c in customers:
        title = f"Payment due: {c.name}"
        if Notification.objects.filter(
            notification_type="payment_due",
            title=title,
            is_read=False,
        ).exists():
            continue
        Notification.objects.create(
            title=title,
            message=f"Outstanding balance {c.current_balance}",
            notification_type="payment_due",
            user=None,
        )
