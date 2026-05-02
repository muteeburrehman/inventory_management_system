from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.notifications.models import Notification

from .models import Product


@receiver(post_save, sender=Product)
def low_stock_notification(sender, instance, **kwargs):
    threshold = getattr(settings, "LOW_STOCK_THRESHOLD", 10)
    limit = instance.min_stock_level if instance.min_stock_level else threshold
    if instance.current_stock <= limit:
        Notification.objects.create(
            title="Low stock",
            message=f"Product '{instance.name}' (SKU {instance.sku}) is at or below minimum stock ({instance.current_stock}).",
            notification_type="low_stock",
            related_product=instance,
        )
