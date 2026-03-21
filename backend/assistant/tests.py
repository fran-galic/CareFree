from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import Caretaker, HelpCategory, Student
from assistant.llm import _fallback_result, build_messages_for_llm
from assistant.models import AssistantSession, AssistantSessionSummary
from assistant.prompts import build_system_prompt
from assistant.recommendations import find_recommended_caretakers
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

    def test_system_prompt_contains_behavior_rules_for_natural_tone(self):
        prompt = build_system_prompt()

        self.assertIn("ne koristiš emojije", prompt)
        self.assertIn("ne koristiš bullet-point stil", prompt)
        self.assertIn("ne ponašaš se kao customer support", prompt)

    def test_llm_messages_include_only_non_name_profile_context(self):
        self.user.sex = "M"
        self.user.save(update_fields=["sex"])
        session = AssistantSession.objects.create(student=self.student)

        messages = build_messages_for_llm(session, [])

        joined = "\n".join(item["content"] for item in messages)
        self.assertIn("spolu iz profila", joined)
        self.assertIn("Ne spominji da znaš podatke iz profila i ne koristi ime korisnika.", joined)
        self.assertNotIn(self.user.first_name, joined)

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

        response = self.client.post("/assistant/session/message", {"content": "Mislim da mi je za danas dosta, možemo stati."}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["session_closed"])
        self.assertFalse(response.data["show_recommendations"])

        session = AssistantSession.objects.get(student=self.student)
        self.assertEqual(session.closure_reason, AssistantSession.ClosureReason.SUPPORT)
        self.assertFalse(session.is_active)
        self.assertTrue(hasattr(session, "summary"))
        self.assertEqual(session.summary.summary_type, "support")

    @patch("assistant.views.generate_assistant_result")
    def test_support_closure_requires_clear_student_confirmation_to_end(self, mock_generate):
        self.client.post("/assistant/session/start")
        mock_generate.return_value = AssistantLLMResult(
            mode="support_closure",
            message="Možemo ovdje stati za danas.",
            summary="Student je imao podržavajući razgovor.",
            main_category="Stres i akademski pritisci",
            should_end_session=True,
            should_store_summary=True,
        )

        response = self.client.post("/assistant/session/message", {"content": "Hvala ti puno."}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["session_closed"])
        self.assertIn("ne moramo", response.data["bot_message"]["content"])

        session = AssistantSession.objects.get(student=self.student)
        self.assertTrue(session.is_active)
        self.assertFalse(hasattr(session, "summary"))

    @patch("assistant.views.generate_assistant_result")
    def test_support_closure_allows_natural_short_confirmation_like_to_je_to(self, mock_generate):
        self.client.post("/assistant/session/start")
        mock_generate.return_value = AssistantLLMResult(
            mode="support_closure",
            message="Možemo ovdje stati za danas.",
            summary="Student je zadovoljan razgovorom i želi stati.",
            should_end_session=True,
            should_store_summary=True,
        )

        response = self.client.post("/assistant/session/message", {"content": "Ma to je to."}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["session_closed"])

    @patch("assistant.views.generate_assistant_result")
    def test_recommendation_flow_returns_caretakers_and_summary(self, mock_generate):
        category, _ = HelpCategory.objects.get_or_create(label="Stres i akademski pritisci")
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
        self.assertGreater(len(session.summary.transcript_snapshot), 0)
        self.assertEqual(session.messages.count(), 0)

    @patch("assistant.views.generate_assistant_result")
    def test_recommendation_without_clear_category_does_not_close_session(self, mock_generate):
        self.client.post("/assistant/session/start")
        mock_generate.return_value = AssistantLLMResult(
            mode="recommendation_ready",
            message="U nastavku ti mogu predložiti dostupne psihologe.",
            summary="Student želi psihologa, ali još nije jasno što ga točno muči.",
            main_category="",
            subcategories=[],
            should_end_session=True,
            should_show_recommendations=True,
            should_store_summary=True,
        )

        response = self.client.post(
            "/assistant/session/message",
            {"content": "Samo želim da mi preporučiš psihologa, ali ne znam što me točno muči."},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["session_closed"])
        self.assertFalse(response.data["show_recommendations"])
        self.assertIn("što te najviše muči", response.data["bot_message"]["content"])

        session = AssistantSession.objects.get(student=self.student)
        self.assertTrue(session.is_active)
        self.assertFalse(hasattr(session, "summary"))

    @patch("assistant.views.generate_assistant_result")
    def test_recommendation_with_category_but_no_exact_match_shows_general_fallback(self, mock_generate):
        caretaker_user = User.objects.create_user(
            email="fallback.caretaker@example.com",
            password="testpass123",
            first_name="Iva",
            last_name="Marić",
            role="caretaker",
        )
        caretaker = Caretaker.objects.create(
            user=caretaker_user,
            about_me="Podrška studentima",
            is_profile_complete=True,
        )
        caretaker.is_approved = True
        caretaker.approval_status = Caretaker.APPROVAL_APPROVED
        caretaker.save(update_fields=["is_approved", "approval_status"])

        self.client.post("/assistant/session/start")
        mock_generate.return_value = AssistantLLMResult(
            mode="recommendation_ready",
            message="Mogu ti preporučiti psihologe.",
            summary="Student traži preporuku zbog stresa oko fakulteta.",
            main_category="Stres i akademski pritisci",
            subcategories=[],
            should_end_session=True,
            should_show_recommendations=True,
            should_store_summary=True,
        )

        response = self.client.post(
            "/assistant/session/message",
            {"content": "Volio bih da mi preporučiš psihologa."},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["session_closed"])
        self.assertTrue(response.data["show_recommendations"])
        self.assertEqual(len(response.data["recommended_caretakers"]), 1)
        self.assertIn("mogu ti odmah pokazati nekoliko dostupnih psihologa", response.data["bot_message"]["content"].lower())

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

    @patch("assistant.views.generate_assistant_result")
    def test_crisis_recommendation_uses_special_copy(self, mock_generate):
        category, _ = HelpCategory.objects.get_or_create(label="KRIZNE SITUACIJE (RIZIK)")
        caretaker_user = User.objects.create_user(
            email="crisis.caretaker@example.com",
            password="testpass123",
            first_name="Maja",
            last_name="Krizic",
            role="caretaker",
        )
        caretaker = Caretaker.objects.create(
            user=caretaker_user,
            about_me="Krizna podrška",
            is_profile_complete=True,
        )
        caretaker.is_approved = True
        caretaker.approval_status = Caretaker.APPROVAL_APPROVED
        caretaker.save(update_fields=["is_approved", "approval_status"])
        caretaker.help_categories.add(category)

        self.client.post("/assistant/session/start")
        mock_generate.return_value = AssistantLLMResult(
            mode="crisis",
            message="Mogu ti pokazati i psihologe.",
            summary="Student je u krizi i treba dodatnu podršku.",
            main_category="KRIZNE SITUACIJE (RIZIK)",
            danger_flag=True,
            should_end_session=True,
            should_show_recommendations=True,
            should_store_summary=True,
        )

        response = self.client.post("/assistant/session/message", {"content": "Ne znam mogu li večeras ostati siguran."}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["show_recommendations"])
        self.assertIn("Uz ove krizne kontakte", response.data["bot_message"]["content"])

    def test_local_fallback_infers_academic_category_for_recommendation(self):
        main_category, _ = HelpCategory.objects.get_or_create(label="Stres i akademski pritisci")
        HelpCategory.objects.get_or_create(label="Preopterećenost obavezama", parent=main_category)
        session = AssistantSession.objects.create(student=self.student)

        result = _fallback_result(session, "Htio bih psihologa jer me muče ispiti, fakultet i previše obaveza.")

        self.assertEqual(result.mode, "recommendation_ready")
        self.assertEqual(result.main_category, "Stres i akademski pritisci")
        self.assertIn("Preopterećenost obavezama", result.subcategories)

    def test_local_fallback_handles_greeting_without_repeating_generic_prompt(self):
        session = AssistantSession.objects.create(student=self.student)

        result = _fallback_result(session, "Hej bok")

        self.assertEqual(result.mode, "support")
        self.assertIn("Bok", result.message)
        self.assertNotIn("što ti je trenutno najteže", result.message)

    def test_local_fallback_handles_are_you_there_message(self):
        session = AssistantSession.objects.create(student=self.student)

        result = _fallback_result(session, "čuješ li me")

        self.assertEqual(result.mode, "support")
        self.assertIn("čujem te", result.message.lower())

    def test_local_fallback_reflects_specific_family_context_instead_of_only_generic_copy(self):
        session = AssistantSession.objects.create(student=self.student)

        result = _fallback_result(session, "Muči me problem s dedom.")

        self.assertEqual(result.mode, "support")
        self.assertIn("djedom", result.message)

    def test_local_fallback_infers_depressive_category_for_recommendation(self):
        main_category, _ = HelpCategory.objects.get_or_create(label="Depresivni simptomi")
        HelpCategory.objects.get_or_create(label="Tuga, gubitak interesa za aktivnosti", parent=main_category)
        session = AssistantSession.objects.create(student=self.student)

        result = _fallback_result(session, "Iskreno imam neke depresivne simptome i baš sam bezvoljan.")

        self.assertEqual(result.main_category, "Depresivni simptomi")
        self.assertIn("Tuga, gubitak interesa za aktivnosti", result.subcategories)

    def test_recommendations_category_stage_includes_subcategories_of_main_category(self):
        main_category, _ = HelpCategory.objects.get_or_create(label="Depresivni simptomi")
        depressive_subcategory, _ = HelpCategory.objects.get_or_create(
            label="Tuga, gubitak interesa za aktivnosti",
            parent=main_category,
        )

        caretaker_user = User.objects.create_user(
            email="depressive.caretaker@example.com",
            password="testpass123",
            first_name="Lana",
            last_name="Depra",
            role="caretaker",
        )
        caretaker = Caretaker.objects.create(
            user=caretaker_user,
            about_me="Podrška kod depresivnih simptoma",
            is_profile_complete=True,
        )
        caretaker.is_approved = True
        caretaker.approval_status = Caretaker.APPROVAL_APPROVED
        caretaker.save(update_fields=["is_approved", "approval_status"])
        caretaker.help_categories.add(depressive_subcategory)

        ids, serialized, scope = find_recommended_caretakers("Depresivni simptomi", [], request=None)

        self.assertEqual(scope, "category")
        self.assertIn(caretaker.pk, ids)
        self.assertTrue(any(item["user_id"] == caretaker.user_id for item in serialized))

    def test_crisis_fallback_adapts_after_user_says_they_are_alone_and_trust_no_one(self):
        session = AssistantSession.objects.create(
            student=self.student,
            danger_flag=True,
            mode=AssistantSession.SessionMode.CRISIS,
            status=AssistantSession.SessionStatus.CRISIS_ACTIVE,
        )
        session.messages.create(sender="student", content="Želim se ubiti.")
        session.messages.create(
            sender="bot",
            content="Važno mi je da sada provjerimo jesi li na sigurnom. Jesi li sada sam/a i je li uz tebe netko kome vjeruješ?",
        )
        session.messages.create(sender="student", content="Sam sam i nikom ne vjerujem.")

        result = _fallback_result(session, "Sam sam i nikom ne vjerujem.")

        self.assertEqual(result.mode, "crisis")
        self.assertIn("gdje si sada", result.message.casefold())
        self.assertNotIn("čime bi si mogao nauditi", result.message.casefold())

    def test_crisis_fallback_handles_repetition_complaint_without_repeating_same_copy(self):
        session = AssistantSession.objects.create(
            student=self.student,
            danger_flag=True,
            mode=AssistantSession.SessionMode.CRISIS,
            status=AssistantSession.SessionStatus.CRISIS_ACTIVE,
        )
        session.messages.create(sender="student", content="Želim se ubiti.")
        session.messages.create(sender="bot", content="Važno mi je da provjerimo sigurnost.")
        session.messages.create(sender="student", content="Zašto se ponavljaš, to je čudno.")

        result = _fallback_result(session, "Zašto se ponavljaš, to je čudno.")

        self.assertEqual(result.mode, "crisis")
        self.assertIn("U pravu si", result.message)
        self.assertIn("gdje si sada", result.message.casefold())

    def test_crisis_fallback_initial_response_prefers_location_and_company_before_objects(self):
        session = AssistantSession.objects.create(student=self.student)

        result = _fallback_result(session, "Želim se ubiti.")

        self.assertEqual(result.mode, "crisis")
        self.assertIn("gdje se trenutno nalaziš", result.message.casefold())
        self.assertNotIn("čime bi si mogao nauditi", result.message.casefold())

    def test_crisis_fallback_asks_about_immediate_means_only_when_risk_is_imminent(self):
        session = AssistantSession.objects.create(student=self.student, danger_flag=True)

        result = _fallback_result(session, "Imam plan i večeras ću to napraviti.")

        self.assertEqual(result.mode, "crisis")
        self.assertIn("čime bi si mogao nauditi", result.message.casefold())

    def test_crisis_fallback_reduces_hotline_repetition_when_user_is_not_alone_and_overwhelmed(self):
        session = AssistantSession.objects.create(student=self.student, danger_flag=True)

        result = _fallback_result(session, "Nisam sam, samo sam potpuno preopterećen oko faksa.")

        self.assertEqual(result.mode, "crisis")
        self.assertIn("dobro je da nisi sam", result.message.casefold())
        self.assertNotIn("112", result.message)

    def test_summary_detail_reads_transcript_snapshot_after_recommendation_cleanup(self):
        session = AssistantSession.objects.create(
            student=self.student,
            is_active=False,
            closure_reason=AssistantSession.ClosureReason.RECOMMENDATION,
            status=AssistantSession.SessionStatus.RECOMMENDATION_COMPLETED,
        )
        summary = AssistantSessionSummary.objects.create(
            student=self.student,
            session=session,
            content="Sažetak razgovora.",
            summary_type=AssistantSessionSummary.SummaryType.RECOMMENDATION,
            transcript_snapshot=[
                {
                    "sender": "student",
                    "content": "Muči me stres oko fakulteta.",
                    "created_at": "2026-03-21T10:00:00+00:00",
                    "sequence": 1,
                },
                {
                    "sender": "bot",
                    "content": "Hajdemo to malo razmotriti.",
                    "created_at": "2026-03-21T10:00:10+00:00",
                    "sequence": 2,
                },
            ],
        )

        response = self.client.get(f"/assistant/summaries/{summary.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["messages"]), 2)
        self.assertEqual(response.data["messages"][0]["content"], "Muči me stres oko fakulteta.")
