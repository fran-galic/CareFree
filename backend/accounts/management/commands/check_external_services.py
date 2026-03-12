from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Check readiness of configured external services without printing secrets."

    def handle(self, *args, **options):
        checks = [
            self._check_openai(),
            self._check_email(),
            self._check_shared_calendar(),
            self._check_b2(),
        ]

        failures = [check for check in checks if check["status"] == "missing"]
        warnings = [check for check in checks if check["status"] == "warning"]

        for check in checks:
            icon = {
                "ok": "[OK]",
                "warning": "[WARN]",
                "missing": "[MISS]",
            }[check["status"]]
            self.stdout.write(f"{icon} {check['name']}: {check['message']}")

        self.stdout.write("")
        self.stdout.write(
            f"Summary: {len(checks) - len(failures)}/{len(checks)} checks passed, "
            f"{len(warnings)} warning(s), {len(failures)} missing requirement(s)."
        )

        if failures:
            raise SystemExit(1)

    def _check_openai(self) -> dict[str, str]:
        key = (getattr(settings, "OPENAI_API_KEY", "") or "").strip()
        if not key:
            return {
                "name": "OpenAI",
                "status": "missing",
                "message": "OPENAI_API_KEY is not configured.",
            }
        return {
            "name": "OpenAI",
            "status": "ok",
            "message": "OPENAI_API_KEY is present.",
        }

    def _check_email(self) -> dict[str, str]:
        provider = (getattr(settings, "EMAIL_PROVIDER", "") or "").strip().lower()
        default_from = (getattr(settings, "DEFAULT_FROM_EMAIL", "") or "").strip()

        if provider == "resend":
            resend_key = (getattr(settings, "RESEND_API_KEY", "") or "").strip()
            if not resend_key:
                return {
                    "name": "Email",
                    "status": "missing",
                    "message": "EMAIL_PROVIDER is resend but RESEND_API_KEY is missing.",
                }
            if not default_from:
                return {
                    "name": "Email",
                    "status": "warning",
                    "message": "Resend is configured, but DEFAULT_FROM_EMAIL is empty.",
                }
            return {
                "name": "Email",
                "status": "ok",
                "message": "Resend configuration is present.",
            }

        host_user = (getattr(settings, "EMAIL_HOST_USER", "") or "").strip()
        if host_user:
            return {
                "name": "Email",
                "status": "warning",
                "message": "SMTP fallback appears configured. Current provider is not resend.",
            }

        return {
            "name": "Email",
            "status": "warning",
            "message": "No resend provider configured; email will rely on SMTP/default backend settings.",
        }

    def _check_shared_calendar(self) -> dict[str, str]:
        calendar_id = (getattr(settings, "GOOGLE_CALENDAR_ID", "") or "").strip()
        service_account_file = (getattr(settings, "GOOGLE_SERVICE_ACCOUNT_FILE", "") or "").strip()
        service_account_info = getattr(settings, "GOOGLE_SERVICE_ACCOUNT_INFO", None)

        if not calendar_id or calendar_id == "primary":
            return {
                "name": "Shared Google Calendar",
                "status": "missing",
                "message": "GOOGLE_CALENDAR_ID must be set to the shared calendar ID, not primary.",
            }

        if service_account_file:
            path = Path(service_account_file)
            if not path.is_file():
                return {
                    "name": "Shared Google Calendar",
                    "status": "missing",
                    "message": f"GOOGLE_SERVICE_ACCOUNT_FILE does not exist: {path}",
                }
            try:
                json.loads(path.read_text())
            except Exception as exc:
                return {
                    "name": "Shared Google Calendar",
                    "status": "missing",
                    "message": f"Service account file is not valid JSON: {exc}",
                }
            return {
                "name": "Shared Google Calendar",
                "status": "ok",
                "message": "Shared calendar ID and service account file look valid.",
            }

        if service_account_info:
            return {
                "name": "Shared Google Calendar",
                "status": "ok",
                "message": "Shared calendar ID and inline service account JSON are present.",
            }

        return {
            "name": "Shared Google Calendar",
            "status": "missing",
            "message": "Set GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_JSON.",
        }

    def _check_b2(self) -> dict[str, str]:
        required = {
            "B2_KEY_ID": (getattr(settings, "AWS_ACCESS_KEY_ID", "") or "").strip(),
            "B2_APPLICATION_KEY": (getattr(settings, "AWS_SECRET_ACCESS_KEY", "") or "").strip(),
            "B2_BUCKET_NAME": (getattr(settings, "AWS_STORAGE_BUCKET_NAME", "") or "").strip(),
            "B2_ENDPOINT": (getattr(settings, "AWS_S3_ENDPOINT_URL", "") or "").strip(),
            "B2_REGION": (getattr(settings, "AWS_S3_REGION_NAME", "") or "").strip(),
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            return {
                "name": "Backblaze B2",
                "status": "missing",
                "message": f"Missing required B2 settings: {', '.join(missing)}.",
            }
        return {
            "name": "Backblaze B2",
            "status": "ok",
            "message": "B2 storage settings are present.",
        }
