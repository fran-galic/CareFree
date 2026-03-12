from __future__ import annotations

from typing import Iterable

import requests
from django.conf import settings
from django.core.mail import send_mail as django_send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags


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


def get_email_asset_urls() -> dict[str, str]:
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3001").rstrip("/")
    assets_base_url = (getattr(settings, "EMAIL_ASSETS_BASE_URL", "") or "").strip().rstrip("/")
    if not assets_base_url:
        if frontend_url.startswith("http://localhost") or frontend_url.startswith("http://127.0.0.1"):
            assets_base_url = "https://programsko-inzenjerstvo.vercel.app"
        else:
            assets_base_url = frontend_url
    return {
        "frontend_url": frontend_url,
        "logo_url": f"{assets_base_url}/images/logo.png",
        "hero_image_url": f"{assets_base_url}/images/for_email.png",
    }


def render_branded_email(
    *,
    title: str,
    intro: str,
    body_lines: list[str] | None = None,
    action_label: str | None = None,
    action_url: str | None = None,
    recipient_name: str | None = None,
    footer_text: str | None = None,
) -> tuple[str, str]:
    ctx = {
        "title": title,
        "intro": intro,
        "body_lines": body_lines or [],
        "action_label": action_label,
        "action_url": action_url,
        "recipient_name": recipient_name or "korisniče",
        "footer_text": footer_text or "CareFree - sigurno mjesto za podršku i razgovor.",
        **get_email_asset_urls(),
    }
    html_message = render_to_string("emails/base_notification.html", ctx)
    plain_message = strip_tags(html_message)
    return html_message, plain_message


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
