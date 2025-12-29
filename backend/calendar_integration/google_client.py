import json
import os
import uuid

from django.conf import settings


#funkcija za učitavanje Google service account credentials
def _load_credentials():
    info = getattr(settings, "GOOGLE_SERVICE_ACCOUNT_INFO", None)
    file_path = getattr(settings, "GOOGLE_SERVICE_ACCOUNT_FILE", None)
    if info:
        return info
    if file_path and os.path.exists(file_path):
        with open(file_path, encoding="utf-8") as f:
            return json.load(f)
    default_secret = os.path.expanduser(os.path.join("~", ".secrets", "carefree-calendar.json"))
    if os.path.exists(default_secret):
        try:
            with open(default_secret, encoding="utf-8") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            pass
    return None

#funkcija za izgradnju Google kalendar API servisa
def build_service():
    info = _load_credentials()
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except Exception:
        raise

    creds = None
    if info:
        creds = Credentials.from_service_account_info(info, scopes=["https://www.googleapis.com/auth/calendar"])
    else:
        file_path = getattr(settings, "GOOGLE_SERVICE_ACCOUNT_FILE", None)
        if not file_path:
            file_path = os.path.expanduser(os.path.join("~", ".secrets", "carefree-calendar.json"))
        creds = Credentials.from_service_account_file(file_path, scopes=["https://www.googleapis.com/auth/calendar"])

    service = build("calendar", "v3", credentials=creds)
    return service

#funkcija za stvaranje eventa u Google kalendaru
def create_event(
    calendar_id: str,
    summary: str,
    description: str | None = None,
    start: str | None = None,
    end: str | None = None,
    attendees: list[str] | None = None,
    *,
    create_conference: bool = False,
 ) -> dict:
    #stvara event u Google kalendaru i vraća JSON odgovora
    service = build_service()

    event: dict = {"summary": summary}
    if description:
        event["description"] = description
    if start:
        event["start"] = {"dateTime": start}
    if end:
        event["end"] = {"dateTime": end}
    if attendees:
        event["attendees"] = [{"email": a} for a in attendees]

    if create_conference:
        event["conferenceData"] = {
            "createRequest": {"requestId": uuid.uuid4().hex,},
        }
        created = (
            service.events()
            .insert(calendarId=calendar_id, body=event, conferenceDataVersion=1)
            .execute()
        )
    else:
        created = service.events().insert(calendarId=calendar_id, body=event).execute()
    return created
