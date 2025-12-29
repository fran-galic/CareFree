# API views za calendar_integration aplikaciju
# Sadrži admin-only endpoint-e za listu događaja, pokretanje sinkronizacije i
# kreiranje događaja u Google Calendaru

from typing import ClassVar
from django.core.management import CommandError

try:
    from googleapiclient.errors import HttpError
except ImportError:
    HttpError = Exception

from django.conf import settings
from django.core.management import call_command
from rest_framework.permissions import IsAdminUser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .google_client import create_event
from .models import Calendar, CalendarEvent
from .serializers import CalendarEventSerializer


#prikaz nedavnih događaja pohranjenih u lokalnoj bazi
class CalendarEventList(APIView):
    #admin-only view: vraća nedavne događaje pohranjene lokalno
    permission_classes: ClassVar[list[type]] = [IsAdminUser]

    def get(self, request: Request) -> Response:
        #vraća do 200 najnovijih događaja
        qs = CalendarEvent.objects.all().order_by("-start")[:200]
        serializer = CalendarEventSerializer(qs, many=True)
        return Response(serializer.data)


#endpoint za trenutno pokretanje sinkronizacije (admin)
class SyncNowView(APIView):
    permission_classes: ClassVar[list[type]] = [IsAdminUser]

    def post(self, request: Request) -> Response:
        # Pokreće management naredbu koja sinkronizira Google Calendar u DB
        try:
            call_command("sync_google_calendar")
            return Response({"status": "sync_triggered"})
        except (CommandError, OSError) as exc:  # pragma: no cover - expected failures
            return Response({"status": "error", "detail": str(exc)}, status=500)


#endpoint za kreiranje događaja u Google kalendaru i spremanje lokalno (admin)
class CreateEventView(APIView):
    permission_classes: ClassVar[list[type]] = [IsAdminUser]

    def post(self, request: Request) -> Response:
        data = request.data
        summary = data.get("summary")
        if not summary:
            return Response({"detail": "summary is required"}, status=400)

        description = data.get("description")
        start = data.get("start")
        end = data.get("end")
        attendees = data.get("attendees")
        create_conf = bool(data.get("create_conference", False))

        calendar_id = getattr(settings, "GOOGLE_CALENDAR_ID", "primary")

        try:
            ev = create_event(
                calendar_id,
                summary=summary,
                description=description,
                start=start,
                end=end,
                attendees=attendees,
                create_conference=create_conf,
            )
        except (HttpError, OSError) as exc:
            return Response({"status": "error", "detail": str(exc)}, status=500)

        cal_obj, _ = Calendar.objects.get_or_create(
            calendar_id=calendar_id, defaults={"name": calendar_id},
        )

        start_dt = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date")
        end_dt = ev.get("end", {}).get("dateTime") or ev.get("end", {}).get("date")

        obj, created = CalendarEvent.objects.update_or_create(
            google_event_id=ev.get("id"),
            defaults={
                "calendar": cal_obj,
                "summary": ev.get("summary", ""),
                "description": ev.get("description", ""),
                "start": start_dt,
                "end": end_dt,
                "meet_link": None,
                "raw": ev,
            },
        )

        serializer = CalendarEventSerializer(obj)
        return Response({"created": created, "event": serializer.data})
