from calendar_integration.views import CreateEventView
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from rest_framework.test import APIRequestFactory, force_authenticate


class Command(BaseCommand):
    help = "Test creating a Google Calendar event via CreateEventView (simulated API request)"

    def handle(self, *args, **options):
        User = get_user_model()

        #novi admin korisnik za autentikaciju
        admin, _ = User.objects.get_or_create(username="ci_admin", defaults={"is_staff": True, "is_superuser": True})
        if not admin.email:
            admin.email = "ci-admin@example.com"
            admin.save()

        factory = APIRequestFactory()
        view = CreateEventView.as_view()

        #priprema podataka za novi event
        import datetime
        now = datetime.datetime.utcnow() + datetime.timedelta(days=1)
        start = now.replace(hour=12, minute=0, second=0, microsecond=0).isoformat() + "Z"
        end = (now.replace(hour=13, minute=0, second=0, microsecond=0)).isoformat() + "Z"

        payload = {
            "summary": "API Test Event",
            "description": "Created by management command test_create_event_api",
            "start": start,
            "end": end,
            "create_conference": True,
        }

        req = factory.post("/api/calendar/create/", payload, format="json")
        force_authenticate(req, user=admin)
        resp = view(req)
        self.stdout.write(f"Status: {resp.status_code} Data: {resp.data}")
