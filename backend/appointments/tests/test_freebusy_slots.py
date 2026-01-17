from django.test import TestCase
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from accounts.models import User, Caretaker
from calendar_integration.models import GoogleCredential
from appointments.services import get_caretaker_slots
from unittest.mock import patch


class FreeBusySlotsTests(TestCase):
    def setUp(self):
        # create caretaker user
        self.caretaker_user = User.objects.create_user(
            email='caretaker2@example.com',
            password='pass1234',
            first_name='Care2',
            last_name='Taker2',
            role='caretaker',
            username='caretaker2'
        )
        self.caretaker = Caretaker.objects.create(user=self.caretaker_user)

        # prepare a GoogleCredential record (scaffold) pointing to primary calendar
        self.cred = GoogleCredential.objects.create(
            user=self.caretaker_user,
            access_token='fake-token',
            refresh_token='fake-refresh',
            token_uri='https://oauth2.googleapis.com/token',
            client_id='fake-client',
            client_secret='fake-secret',
            scopes='https://www.googleapis.com/auth/calendar.freebusy',
        )

    def test_freebusy_makes_slot_unavailable(self):
        tz = ZoneInfo('Europe/Zagreb')
        now_local = datetime.now(tz=tz)
        # pick tomorrow 10:00 slot
        target_local = (now_local + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        # build busy interval in UTC covering that slot
        busy_start = target_local.astimezone(ZoneInfo('UTC'))
        busy_end = (target_local + timedelta(hours=1)).astimezone(ZoneInfo('UTC'))

        fb_response = {
            'calendars': {
                'primary': {
                    'busy': [
                        {'start': busy_start.isoformat(), 'end': busy_end.isoformat()}
                    ]
                }
            }
        }

        with patch('calendar_integration.google_client.freebusy_query', return_value=fb_response) as mocked:
            slots = get_caretaker_slots(self.caretaker, days=2, start_hour=10, end_hour=11)

        # find the slot that matches the exact local start we targeted and assert it's unavailable
        target_iso = target_local.isoformat()
        found = [s for s in slots if s.get('start') == target_iso]
        self.assertTrue(len(found) == 1, msg=f"Expected 1 matching slot for {target_iso}, got {len(found)}: {slots}")
        self.assertFalse(found[0]['is_available'])
