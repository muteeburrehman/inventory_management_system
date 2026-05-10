"""Transactional email: HTML + plain text templates, optional Celery dispatch."""

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from kombu.exceptions import OperationalError as KombuBrokerError

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
        try:
            from apps.accounts.tasks import send_invite_email_task

            send_invite_email_task.delay(user.pk, raw_token)
            logger.info(
                "Queued invite email on Celery for user_id=%s (check worker terminal for send logs / console output).",
                user.pk,
            )
            return
        except ImportError:
            logger.warning(
                "CELERY_BROKER_URL is set but Celery is not installed; run "
                "`pip install -r requirements.txt` (or `pip install 'celery[redis]>=5.3,<6'`). "
                "Sending invite email synchronously.",
            )
        except KombuBrokerError as exc:
            task_broker = getattr(
                getattr(send_invite_email_task, "app", None),
                "conf",
                None,
            )
            task_broker_url = getattr(task_broker, "broker_url", None) if task_broker else None
            logger.warning(
                "Celery enqueue failed (broker Kombu error). task_app.broker_url=%r "
                "Django CELERY_BROKER_URL=%r; sending invite email synchronously: %s",
                task_broker_url,
                settings.CELERY_BROKER_URL,
                exc,
            )
    try:
        send_invite_email_sync(user, raw_token)
    except Exception:
        logger.exception("Invite email failed (sync)")


def dispatch_password_reset_email(user_email: str, raw_token: str) -> None:
    if settings.CELERY_BROKER_URL:
        try:
            from apps.accounts.tasks import send_password_reset_email_task

            send_password_reset_email_task.delay(user_email, raw_token)
            logger.info(
                "Queued password reset email on Celery for %s (check worker terminal for logs / console email output).",
                user_email,
            )
            return
        except ImportError:
            logger.warning(
                "CELERY_BROKER_URL is set but Celery is not installed; run "
                "`pip install -r requirements.txt`. Sending password reset email synchronously.",
            )
        except KombuBrokerError as exc:
            task_broker = getattr(
                getattr(send_password_reset_email_task, "app", None),
                "conf",
                None,
            )
            task_broker_url = getattr(task_broker, "broker_url", None) if task_broker else None
            logger.warning(
                "Celery enqueue failed (broker Kombu error). task_app.broker_url=%r "
                "Django CELERY_BROKER_URL=%r; sending password reset email synchronously: %s",
                task_broker_url,
                settings.CELERY_BROKER_URL,
                exc,
            )
    try:
        send_password_reset_email_sync(user_email, raw_token)
    except Exception:
        logger.exception("Password reset email failed (sync)")

