import datetime
import time
from collections.abc import Callable
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import DatabaseError

from calendar_integration.models import Calendar, CalendarEvent

try:
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    Credentials = None
    build = None
    HttpError = Exception


#management command za sinkronizaciju Google Calendar evenata u CalendarEvent modele
class Command(BaseCommand):

    help = "Sync Google Calendar events into CalendarEvent models (skeleton)"

    def _execute_with_retries(
        self,
        func: Callable[[], Any],
        max_retries: int = 5,
        base_delay: float = 1.0,
    ) -> Any:
        # Izvršava bezarg funkciju s eksponencijalnim povratkom pri greškama.
        # Retry za `HttpError` i `OSError`.
        attempt = 0
        while True:
            try:
                return func()
            except HttpError as err:
                attempt += 1
                if attempt > max_retries:
                    raise
                delay = base_delay * (2 ** (attempt - 1))
                self.stdout.write(
                    self.style.WARNING(
                        f"Google API error, retry {attempt}/{max_retries} in {delay}s"
                    )
                )
                self.stdout.write(self.style.WARNING(str(err)))
                time.sleep(delay)
            except OSError as err:
                attempt += 1
                if attempt > max_retries:
                    raise
                delay = base_delay * (2 ** (attempt - 1))
                self.stdout.write(
                    self.style.WARNING(
                        f"Network error, retry {attempt}/{max_retries} in {delay}s"
                    )
                )
                self.stdout.write(self.style.WARNING(str(err)))
                time.sleep(delay)

    #ulazna točka naredbe sync_google_calendar
    def handle(self, *args, **options) -> None:
        self.stdout.write("Starting calendar sync (skeleton)")

        info = getattr(settings, "GOOGLE_SERVICE_ACCOUNT_INFO", None)
        file_path = getattr(settings, "GOOGLE_SERVICE_ACCOUNT_FILE", None)

        if not info and not file_path:
            self.stdout.write(
                self.style.WARNING(
                    "No Google service account configured. Running in dry-run mode."
                )
            )
            cal, _ = Calendar.objects.get_or_create(
                calendar_id=getattr(settings, "GOOGLE_CALENDAR_ID", "primary"),
                defaults={"name": "default"},
            )
            now = timezone.now()
            event_id = f"dryrun-{now.date().isoformat()}"
            _, created = CalendarEvent.objects.update_or_create(
                google_event_id=event_id,
                defaults={
                    "calendar": cal,
                    "summary": "Dry-run sample event",
                    "description": "Simulated event (no credentials).",
                    "start": now,
                    "end": now + datetime.timedelta(hours=1),
                    "raw": {"dry_run": True},
                },
            )
            self.stdout.write(
                self.style.SUCCESS(f"Dry-run sync complete. created={created}")
            )
            return

        #provjera da li su googleapiclient moduli dostupni
        if Credentials is None or build is None:
            self.stdout.write(
                self.style.WARNING(
                    "googleapiclient not installed — install google-api-python-client"
                )
            )
            return

        #inicijalizacija Google Calendar API servisa
        creds = None
        try:
            if info:
                creds = Credentials.from_service_account_info(
                    info, scopes=["https://www.googleapis.com/auth/calendar"],
                )
            else:
                creds = Credentials.from_service_account_file(
                    file_path, scopes=["https://www.googleapis.com/auth/calendar"],
                )
        except (ValueError, FileNotFoundError, OSError) as exc:
            self.stdout.write(
                self.style.ERROR(
                    f"Failed to load service account credentials: {exc}"
                )
            )
            return

        service = build("calendar", "v3", credentials=creds)

        calendar_id = getattr(settings, "GOOGLE_CALENDAR_ID", "primary")

        #time window za dohvat evenata
        now = timezone.now()
        time_min = (now - datetime.timedelta(days=1)).isoformat()
        time_max = (now + datetime.timedelta(days=90)).isoformat()

        events: list[dict[str, Any]] = []
        page_token: str | None = None
        while True:
            token = page_token

            def _fetch(token=token) -> dict[str, Any]:
                params: dict[str, Any] = {
                    "calendarId": calendar_id,
                    "timeMin": time_min,
                    "timeMax": time_max,
                    "singleEvents": True,
                    "orderBy": "startTime",
                    "maxResults": 250,
                }
                if token:
                    params["pageToken"] = token
                return service.events().list(**params).execute()

            try:
                result = self._execute_with_retries(_fetch)
            except (HttpError, OSError) as exc:
                msg = "Failed to fetch events from Google Calendar."
                self.stdout.write(self.style.ERROR(msg))
                self.stdout.write(self.style.ERROR(str(exc)))
                return

            items = result.get("items", [])
            events.extend(items)
            page_token = result.get("nextPageToken")
            if not page_token:
                break

        created = 0
        updated = 0
        cal, _ = Calendar.objects.get_or_create(
            calendar_id=calendar_id, defaults={"name": calendar_id}
        )

        created, updated = self._process_events(events, cal)

        self.stdout.write(
            self.style.SUCCESS(
                f"Sync finished. created={created} updated={updated} total={len(events)}"
            )
        )

    #obrada eventa i upsert u CalendarEvent (vraća created, updated)
    def _process_events(self, events: list[dict[str, Any]], cal: Calendar) -> tuple[int, int]:
        created = 0
        updated = 0

        for ev in events:
            gid = ev.get("id")
            start = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date")
            end = ev.get("end", {}).get("dateTime") or ev.get("end", {}).get("date")

            meet = None
            conf = ev.get("conferenceData") or {}
            if conf:
                entry_points = conf.get("entryPoints") or []
                for ep in entry_points:
                    if ep.get("entryPointType") == "video" and ep.get("uri"):
                        meet = ep.get("uri")
                        break

            defaults = {
                "calendar": cal,
                "summary": ev.get("summary", ""),
                "description": ev.get("description", ""),
                "start": start,
                "end": end,
                "meet_link": meet,
                "raw": ev,
            }

            try:
                _, was_created = CalendarEvent.objects.update_or_create(
                    google_event_id=gid, defaults=defaults
                )
            except DatabaseError as db_exc:
                self.stdout.write(self.style.ERROR(f"Failed to upsert event {gid}: {db_exc}"))
                continue

            if was_created:
                created += 1
            else:
                updated += 1

        return created, updated
