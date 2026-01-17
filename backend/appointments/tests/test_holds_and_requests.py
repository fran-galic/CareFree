from django.test import TestCase
from rest_framework.test import APIClient
from django.urls import reverse
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from accounts.models import User, Student, Caretaker
from appointments.models import ReservationHold, AppointmentRequest


class HoldsAndRequestsTests(TestCase):
    def setUp(self):
        # create caretaker user
        self.caretaker_user = User.objects.create_user(
            email='caretaker@example.com',
            password='pass1234',
            first_name='Care',
            last_name='Taker',
            role='caretaker',
            username='caretaker1'
        )
        self.caretaker = Caretaker.objects.create(user=self.caretaker_user)

        # create student user
        self.student_user = User.objects.create_user(
            email='student@example.com',
            password='pass1234',
            first_name='Stu',
            last_name='Dent',
            role='student',
            username='student1'
        )
        self.student = Student.objects.create(user=self.student_user)

        # another student
        self.other_user = User.objects.create_user(
            email='other@example.com',
            password='pass1234',
            first_name='Other',
            last_name='Student',
            role='student',
            username='student2'
        )
        self.other = Student.objects.create(user=self.other_user)

        self.client = APIClient()

        # slot time: tomorrow at 10:00 Europe/Zagreb
        tz = ZoneInfo('Europe/Zagreb')
        now_local = datetime.now(tz=tz)
        slot_local = (now_local + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        self.slot_local = slot_local
        self.slot_iso = slot_local.isoformat()

    def test_consume_hold_on_request(self):
        # student places a hold
        self.client.force_authenticate(user=self.student_user)
        url = reverse('holds-create')
        resp = self.client.post(url, {'caretaker_id': self.caretaker.user.id, 'slot_start': self.slot_iso})
        self.assertEqual(resp.status_code, 200)
        hold_id = resp.data.get('id')
        self.assertIsNotNone(hold_id)

        # now student posts appointment request for same slot
        req_url = reverse('appointment-request')
        # start_time can be date string (YYYY-MM-DD); view will interpret in Europe/Zagreb
        start_time = self.slot_local.date().isoformat()
        resp2 = self.client.post(req_url, {'caretaker_id': self.caretaker.user.id, 'start_time': start_time, 'slot_time': '10:00', 'note': 'Testing'})
        self.assertEqual(resp2.status_code, 201, msg=f"Resp: {resp2.data}")

        # hold should be consumed
        hold = ReservationHold.objects.get(pk=hold_id)
        self.assertEqual(hold.status, ReservationHold.STATUS_CONSUMED)

        # appointment request created
        reqs = AppointmentRequest.objects.filter(caretaker=self.caretaker, student=self.student)
        self.assertTrue(reqs.exists())

    def test_reject_when_held_by_other(self):
        # other student places a hold
        self.client.force_authenticate(user=self.other_user)
        url = reverse('holds-create')
        resp = self.client.post(url, {'caretaker_id': self.caretaker.user.id, 'slot_start': self.slot_iso})
        self.assertEqual(resp.status_code, 200)
        hold_id = resp.data.get('id')

        # now first student tries to create request
        self.client.force_authenticate(user=self.student_user)
        req_url = reverse('appointment-request')
        start_time = self.slot_local.date().isoformat()
        resp2 = self.client.post(req_url, {'caretaker_id': self.caretaker.user.id, 'start_time': start_time, 'slot_time': '10:00', 'note': 'Trying to steal'})
        self.assertEqual(resp2.status_code, 400)
        self.assertIn('held', str(resp2.data.get('detail')).lower())

        # hold should remain active
        hold = ReservationHold.objects.get(pk=hold_id)
        self.assertEqual(hold.status, ReservationHold.STATUS_ACTIVE)
