from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import Caretaker, HelpCategory, Student
from assistant.models import AssistantSession
from assistant.schemas import AssistantLLMResult

User = get_user_model()


class AssistantFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="student@example.com",
            password="testpass123",
            first_name="Test",
            last_name="Student",
            role="student",
        )
        self.student = Student.objects.create(user=self.user, studying_at="FER", year_of_study=3)
        self.client.force_authenticate(self.user)

    def test_start_session_returns_ui_hint(self):
        response = self.client.post("/assistant/session/start")

        self.assertEqual(response.status_code, 201)
        self.assertIn("ui_hint", response.data)
        self.assertEqual(response.data["session"]["status"], AssistantSession.SessionStatus.ACTIVE)

    def test_end_session_fails_before_student_message(self):
        self.client.post("/assistant/session/start")

        response = self.client.post("/assistant/session/end")

        self.assertEqual(response.status_code, 400)

    @patch("assistant.views.generate_assistant_result")
    def test_support_closure_message_stores_summary_and_closes_session(self, mock_generate):
        self.client.post("/assistant/session/start")
        mock_generate.return_value = AssistantLLMResult(
            mode="support_closure",
            message="Mozemo ovdje stati za danas ako zelis.",
            summary="Student je razgovarao o preopterecenosti i umoru.",
            main_category="Stres i akademski pritisci",
            subcategories=["preopterećenost obavezama"],
            should_end_session=True,
            should_store_summary=True,
        )

        response = self.client.post("/assistant/session/message", {"content": "Danas sam bas preopterecen."}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["session_closed"])
        self.assertFalse(response.data["show_recommendations"])

        session = AssistantSession.objects.get(student=self.student)
        self.assertEqual(session.closure_reason, AssistantSession.ClosureReason.SUPPORT)
        self.assertFalse(session.is_active)
        self.assertTrue(hasattr(session, "summary"))
        self.assertEqual(session.summary.summary_type, "support")

    @patch("assistant.views.generate_assistant_result")
    def test_recommendation_flow_returns_caretakers_and_summary(self, mock_generate):
        category = HelpCategory.objects.create(label="Stres i akademski pritisci")
        caretaker_user = User.objects.create_user(
            email="caretaker@example.com",
            password="testpass123",
            first_name="Ana",
            last_name="Horvat",
            role="caretaker",
        )
        caretaker = Caretaker.objects.create(
            user=caretaker_user,
            about_me="Rad sa studentima pod stresom",
            is_profile_complete=True,
        )
        caretaker.is_approved = True
        caretaker.approval_status = Caretaker.APPROVAL_APPROVED
        caretaker.save(update_fields=["is_approved", "approval_status"])
        caretaker.help_categories.add(category)

        self.client.post("/assistant/session/start")
        mock_generate.return_value = AssistantLLMResult(
            mode="recommendation_ready",
            message="Na temelju ovoga mogu ti predloziti nekoliko psihologa.",
            summary="Student opisuje jaci akademski stres i tjeskobu oko rokova.",
            main_category="Stres i akademski pritisci",
            subcategories=["preopterećenost obavezama"],
            should_end_session=True,
            should_show_recommendations=True,
            should_store_summary=True,
        )

        response = self.client.post("/assistant/session/message", {"content": "Mozes mi predloziti psihologe?"}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["session_closed"])
        self.assertTrue(response.data["show_recommendations"])
        self.assertEqual(len(response.data["recommended_caretakers"]), 1)

        session = AssistantSession.objects.get(student=self.student)
        self.assertEqual(session.closure_reason, AssistantSession.ClosureReason.RECOMMENDATION)
        self.assertEqual(session.summary.summary_type, "recommendation")

    @patch("assistant.views.generate_assistant_result")
    def test_crisis_mode_raises_panel_without_forcing_recommendations(self, mock_generate):
        self.client.post("/assistant/session/start")
        mock_generate.return_value = AssistantLLMResult(
            mode="crisis",
            message="Drago mi je da si to rekao/la. Jesi li sada na sigurnom?",
            summary="Student pokazuje krizni rizik i treba dodatnu sigurnosnu podrsku.",
            main_category="KRIZNE SITUACIJE (RIZIK)",
            danger_flag=True,
            should_store_summary=True,
        )

        response = self.client.post("/assistant/session/message", {"content": "Ne znam mogu li ovako vise."}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["danger_flag"])
        self.assertTrue(response.data["show_crisis_panel"])
        self.assertFalse(response.data["show_recommendations"])

        session = AssistantSession.objects.get(student=self.student)
        self.assertEqual(session.mode, AssistantSession.SessionMode.CRISIS)
        self.assertEqual(session.status, AssistantSession.SessionStatus.CRISIS_ACTIVE)
