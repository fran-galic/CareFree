from __future__ import annotations

from typing import Iterable

import requests
from django.conf import settings
from django.core.mail import send_mail


RESEND_API_URL = "https://api.resend.com/emails"


def _to_list(recipient_list: Iterable[str] | None) -> list[str]:
    if not recipient_list:
        return []
    cleaned: list[str] = []
    for email in recipient_list:
        value = (email or "").strip()
        if value:
            cleaned.append(value)
    return cleaned


def send_transactional_email(
    *,
    subject: str,
    message: str,
    recipient_list: Iterable[str],
    html_message: str | None = None,
    from_email: str | None = None,
    fail_silently: bool = False,
) -> bool:
    recipients = _to_list(recipient_list)
    if not recipients:
        return False

    sender = from_email or getattr(settings, "RESEND_FROM_EMAIL", None) or getattr(settings, "DEFAULT_FROM_EMAIL", None)
    resend_api_key = (getattr(settings, "RESEND_API_KEY", "") or "").strip()
    resend_reply_to = (getattr(settings, "RESEND_REPLY_TO", "") or "").strip()

    if resend_api_key:
        payload: dict[str, object] = {
            "from": sender,
            "to": recipients,
            "subject": subject,
        }
        if html_message:
            payload["html"] = html_message
        if message:
            payload["text"] = message
        if resend_reply_to:
            payload["reply_to"] = [resend_reply_to]

        try:
            response = requests.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=15,
            )
            response.raise_for_status()
            return True
        except Exception:
            if fail_silently:
                return False
            raise

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=sender,
            recipient_list=recipients,
            html_message=html_message,
            fail_silently=fail_silently,
        )
        return True
    except Exception:
        if fail_silently:
            return False
        raise
