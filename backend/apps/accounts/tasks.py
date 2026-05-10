"""Celery tasks (loaded when CELERY_BROKER_URL is set and a worker is running)."""

import logging

from celery import shared_task
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_kwargs={"max_retries": 5},
)
def send_invite_email_task(self, user_id: int, raw_token: str) -> None:
    from apps.accounts.mail import send_invite_email_sync

    User = get_user_model()
    user = User.objects.get(pk=user_id)
    logger.info("Celery: sending invite email task user_id=%s email=%s", user_id, user.email)
    send_invite_email_sync(user, raw_token)
    logger.info("Celery: invite email task finished for user_id=%s", user_id)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_kwargs={"max_retries": 5},
)
def send_password_reset_email_task(self, user_email: str, raw_token: str) -> None:
    from apps.accounts.mail import send_password_reset_email_sync

    logger.info("Celery: sending password reset email task to=%s", user_email)
    send_password_reset_email_sync(user_email, raw_token)
    logger.info("Celery: password reset email task finished to=%s", user_email)
