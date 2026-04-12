from django.contrib.auth import get_user_model
from unittest.mock import patch

from rest_framework.test import APITestCase


User = get_user_model()


class JournalSafetyTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="journal.student@example.com",
            password="testpass123",
            first_name="Journal",
            last_name="Student",
            role="student",
        )
        self.client.force_authenticate(self.user)

    def test_journal_entry_marks_crisis_content_and_keeps_entry(self):
        response = self.client.post(
            "/api/journal/",
            {
                "title": "Težak dan",
                "content": "Imam osjećaj da se želim ubiti i ne znam kako dalje.",
                "mood": "vrlo-tuzno:anksiozno",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["crisis_detected"])
        self.assertIn("hitnu stručnu pomoć", response.data["analysis_summary"])

        list_response = self.client.get("/api/journal/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)
        self.assertTrue(list_response.data[0]["crisis_detected"])

    @patch("journal.views.transaction.on_commit", side_effect=lambda fn: fn())
    @patch("journal.views.analyze_journal_entry_safety.delay")
    def test_journal_entry_queues_ai_check_for_non_obvious_risk(self, mock_delay, _mock_on_commit):

        response = self.client.post(
            "/api/journal/",
            {
                "title": "Loše mi je",
                "content": "Ne znam koliko još mogu ovako i osjećam se potpuno bez izlaza.",
                "mood": "vrlo-tuzno:umorno",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["crisis_detected"])
        self.assertIsNone(response.data["analysis_summary"])
        mock_delay.assert_called_once()
