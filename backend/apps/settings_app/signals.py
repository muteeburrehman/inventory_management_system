from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Branch, BusinessSettings


@receiver(post_save, sender=Branch)
def create_default_business_settings(sender, instance, created, **kwargs):
    if created:
        BusinessSettings.objects.get_or_create(
            branch=instance,
            defaults={"business_name": instance.name},
        )
