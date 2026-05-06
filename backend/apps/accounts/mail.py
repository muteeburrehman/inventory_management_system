"""Transactional email: HTML + plain text templates, optional Celery dispatch."""

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def _send_multipart(subject: str, template_base: str, context: dict, to: list[str]) -> None:
    """Render ``accounts/email/{template_base}.txt`` and ``.html`` and send."""
    txt = render_to_string(f"accounts/email/{template_base}.txt", context)
    html = render_to_string(f"accounts/email/{template_base}.html", context)
    msg = EmailMultiAlternatives(
        subject=subject,
        body=txt,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=to,
    )
    msg.attach_alternative(html, "text/html")
    msg.send(fail_silently=False)


def send_invite_email_sync(user, raw_token: str) -> None:
    link = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/accept-invite?token={raw_token}"
    context = {
        "app_name": settings.IMS_APP_NAME,
        "user": user,
        "link": link,
        "hours_valid": settings.INVITE_LINK_VALID_HOURS,
    }
    subject = f"{settings.IMS_APP_NAME} — set up your account"
    _send_multipart(subject, "invite", context, [user.email])


def send_password_reset_email_sync(user_email: str, raw_token: str) -> None:
    link = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?token={raw_token}"
    context = {
        "app_name": settings.IMS_APP_NAME,
        "link": link,
        "minutes_valid": max(1, settings.PASSWORD_RESET_VALID_SECONDS // 60),
    }
    subject = f"{settings.IMS_APP_NAME} — password reset"
    _send_multipart(subject, "password_reset", context, [user_email])


def dispatch_invite_email(user, raw_token: str) -> None:
    if settings.CELERY_BROKER_URL:
        from apps.accounts.tasks import send_invite_email_task

        send_invite_email_task.delay(user.pk, raw_token)
    else:
        try:
            send_invite_email_sync(user, raw_token)
        except Exception:
            logger.exception("Invite email failed (sync)")


def dispatch_password_reset_email(user_email: str, raw_token: str) -> None:
    if settings.CELERY_BROKER_URL:
        from apps.accounts.tasks import send_password_reset_email_task

        send_password_reset_email_task.delay(user_email, raw_token)
    else:
        try:
            send_password_reset_email_sync(user_email, raw_token)
        except Exception:
            logger.exception("Password reset email failed (sync)")

