from django.test import TestCase
from accounts.models import User, Caretaker
from appointments.models import Appointment, AppointmentRequest
from calendar_integration.models import CalendarEvent
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import patch


class GoogleApiMockTests(TestCase):
    def setUp(self):
        self.tz = ZoneInfo('Europe/Zagreb')
        # caretaker + student
        self.caretaker_user = User.objects.create_user(email='gapi_c@example.com', password='pass', first_name='Care', last_name='Api', role='caretaker', username='gapi_c')
        self.caretaker = Caretaker.objects.create(user=self.caretaker_user)

        self.student_user = User.objects.create_user(email='gapi_s@example.com', password='pass', first_name='Stu', last_name='Api', role='student', username='gapi_s')

        # appointment request & appointment object
        now = datetime.now(tz=self.tz)
        start_local = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
        start_utc = start_local.astimezone(ZoneInfo('UTC'))
        end_utc = (start_local + timedelta(hours=1)).astimezone(ZoneInfo('UTC'))

        req = AppointmentRequest.objects.create(
            caretaker=self.caretaker,
            student=None,
            requested_start=start_utc,
            requested_end=end_utc,
            message='Test create event',
        )

        self.appt = Appointment.objects.create(
            appointment_request=req,
            caretaker=self.caretaker,
            student=None,
            start=start_utc,
            end=end_utc,
            status=Appointment.STATUS_CONFIRMED_PENDING,
        )

    def test_sync_create_google_event_uses_create_event(self):
        # mock create_event to return a predictable response
        fake_res = {'id': 'evt_123', 'hangoutLink': 'https://meet.example/abc'}
        with patch('appointments.tasks.create_event', return_value=fake_res) as mocked:
            from appointments.tasks import sync_create_google_event
            # call the task.run with args (task instance is bound automatically)
            sync_create_google_event.run(self.appt.id)

        a = Appointment.objects.get(pk=self.appt.pk)
        self.assertEqual(a.external_event_id, 'evt_123')
        self.assertEqual(a.conference_link, 'https://meet.example/abc')
        self.assertEqual(a.status, Appointment.STATUS_CONFIRMED)

    def test_sync_availability_change_creates_calendar_event(self):
        # mock create_event for availability
        fake_res = {'id': 'avail_1', 'start': {'dateTime': self.appt.start.isoformat()}, 'end': {'dateTime': self.appt.end.isoformat()}, 'summary': 'Nedostupan - CareFree'}
        with patch('appointments.tasks.create_event', return_value=fake_res) as mocked:
            from appointments.tasks import sync_availability_change
            slot_iso = self.appt.start.isoformat()
            # call the task.run with args (task instance is bound automatically)
            sync_availability_change.run(self.caretaker.pk, slot_iso, False)

        # expect a CalendarEvent persisted for availability
        evs = CalendarEvent.objects.filter(source_type='availability', source_id=f"{self.caretaker.pk}:{self.appt.start.isoformat()}")
        self.assertTrue(evs.exists())
