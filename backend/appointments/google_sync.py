from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def get_shared_calendar_id(*, required: bool = True) -> str | None:
    calendar_id = (getattr(settings, "GOOGLE_CALENDAR_ID", "") or "").strip()
    if calendar_id and calendar_id != "primary":
        return calendar_id
    if required:
        raise ImproperlyConfigured(
            "GOOGLE_CALENDAR_ID must be configured for the shared system calendar"
        )
    return None


def sanitize_attendees(attendees: list[str] | None) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for attendee in attendees or []:
        try:
            email = (attendee or "").strip().lower()
        except Exception:
            continue
        if not email or "@" not in email or email in seen:
            continue
        seen.add(email)
        cleaned.append(email)
    return cleaned


def extract_conference_link(result: dict | None) -> str | None:
    if not result:
        return None
    return (
        result.get("hangoutLink")
        or (result.get("conferenceData", {}).get("entryPoints") or [{}])[0].get("uri")
        or result.get("conference_link")
    )


def build_appointment_payload(appt) -> dict:
    attendees = sanitize_attendees(
        [getattr(appt.caretaker.user, "email", "")]
        + ([appt.student.user.email] if appt.student else [])
    )
    return {
        "start": appt.start.isoformat(),
        "end": appt.end.isoformat(),
        "summary": "Sastanak - CareFree",
        "attendees": attendees,
        "description": appt.appointment_request.ai_summary
        or appt.appointment_request.message
        or "",
    }
