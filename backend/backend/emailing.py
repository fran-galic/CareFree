from __future__ import annotations

from typing import Iterable

import requests
from django.conf import settings
from django.core.mail import send_mail as django_send_mail


class EmailDeliveryError(RuntimeError):
    pass


def _provider() -> str:
    provider = (getattr(settings, "EMAIL_PROVIDER", "") or "").strip().lower()
    if provider:
        return provider
    if getattr(settings, "RESEND_API_KEY", None):
        return "resend"
    return "smtp"


def _default_from_email() -> str:
    return (
        getattr(settings, "DEFAULT_FROM_EMAIL", None)
        or getattr(settings, "EMAIL_HOST_USER", None)
        or "carefree@support.hr"
    )


def send_project_email(
    *,
    subject: str,
    message: str,
    recipient_list: Iterable[str],
    html_message: str | None = None,
    from_email: str | None = None,
    fail_silently: bool = False,
) -> int:
    recipients = [email for email in recipient_list if email]
    if not recipients:
        return 0

    from_addr = from_email or _default_from_email()
    provider = _provider()

    try:
        if provider == "resend":
            api_key = getattr(settings, "RESEND_API_KEY", None)
            if not api_key:
                raise EmailDeliveryError("RESEND_API_KEY is not configured")

            response = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_addr,
                    "to": recipients,
                    "subject": subject,
                    "text": message,
                    "html": html_message,
                },
                timeout=15,
            )
            if response.status_code >= 400:
                raise EmailDeliveryError(f"Resend API returned {response.status_code}: {response.text}")
            return len(recipients)

        return django_send_mail(
            subject=subject,
            message=message,
            from_email=from_addr,
            recipient_list=recipients,
            html_message=html_message,
            fail_silently=fail_silently,
        )
    except Exception:
        if fail_silently:
            return 0
        raise
