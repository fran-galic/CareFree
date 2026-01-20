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
    user_credentials: dict | None = None,
 ) -> dict:
    #stvara event u Google kalendaru i vraća JSON odgovora
    # if per-user credentials provided (dict or google Credentials), build service with those
    service = None
    if user_credentials:
        try:
            from google.oauth2.credentials import Credentials as UserCredentials
            from googleapiclient.discovery import build
            if isinstance(user_credentials, dict):
                creds = UserCredentials.from_authorized_user_info(user_credentials, scopes=["https://www.googleapis.com/auth/calendar"])
            else:
                creds = user_credentials
            service = build('calendar', 'v3', credentials=creds)
        except Exception:
            # fallback to default service-account service
            service = build_service()
    else:
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
            .insert(calendarId=calendar_id, body=event, conferenceDataVersion=1, sendUpdates='none')
            .execute()
        )
    else:
        created = service.events().insert(calendarId=calendar_id, body=event, sendUpdates='none').execute()
    return created


def list_events(calendar_id: str, time_min: str, time_max: str, *, user_credentials: dict | None = None) -> list:
    """List events in a calendar between time_min and time_max (ISO strings).

    Returns list of event dicts as returned by Google API.
    """
    try:
        from googleapiclient.discovery import build
    except Exception:
        raise

    # build service using user_credentials if provided, else service account
    if user_credentials:
        try:
            from google.oauth2.credentials import Credentials as UserCredentials
            creds = UserCredentials.from_authorized_user_info(user_credentials, scopes=["https://www.googleapis.com/auth/calendar"])
            service = build('calendar', 'v3', credentials=creds)
        except Exception:
            service = build_service()
    else:
        service = build_service()

    events = []
    page_token = None
    while True:
        req = service.events().list(calendarId=calendar_id, timeMin=time_min, timeMax=time_max, singleEvents=True, orderBy='startTime', pageToken=page_token)
        res = req.execute()
        items = res.get('items', [])
        events.extend(items)
        page_token = res.get('nextPageToken')
        if not page_token:
            break
    return events


def freebusy_query(time_min: str, time_max: str, items: list, *, user_credentials: dict | None = None) -> dict:
    """Query freebusy for given items list (each item is {'id': calendarId}).

    Returns Google freebusy response dict.
    """
    try:
        from googleapiclient.discovery import build
    except Exception:
        raise

    if user_credentials:
        try:
            from google.oauth2.credentials import Credentials as UserCredentials
            creds = UserCredentials.from_authorized_user_info(user_credentials, scopes=["https://www.googleapis.com/auth/calendar.freebusy"])
            service = build('calendar', 'v3', credentials=creds)
        except Exception:
            service = build_service()
    else:
        service = build_service()

    body = {
        'timeMin': time_min,
        'timeMax': time_max,
        'items': items,
    }
    res = service.freebusy().query(body=body).execute()
    return res
