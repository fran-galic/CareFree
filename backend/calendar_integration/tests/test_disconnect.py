from django.test import TestCase
from rest_framework.test import APIClient
from django.urls import reverse
from accounts.models import User, Caretaker
from calendar_integration.models import GoogleCredential


class DisconnectTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='guser@example.com', password='pass', first_name='G', last_name='U', role='caretaker', username='gcare')
        self.caretaker = Caretaker.objects.create(user=self.user)
        self.cred = GoogleCredential.objects.create(user=self.user, access_token='t', refresh_token='r', token_uri='u', client_id='cid', client_secret='csecret', scopes='[]')

    def test_disconnect_deletes_credentials(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('calendar-google-disconnect')
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(GoogleCredential.objects.filter(user=self.user).exists())
