from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from accounts.models import User, Student, Caretaker
from appointments.google_sync import extract_conference_link
from appointments.services import create_appointment_request


class ServiceNonExistentFunctionalityTest(TestCase):
    """
    Test Case 9: Testiranje poziva nepostojećih servisnih funkcija
    """

    def test_nonexistent_service_function(self):
        """
        ISPITNI SLUČAJ 28: Nepostojeća funkcionalnost - poziv neimplementiranog servisa
        
        Ulazni podaci:
        - pokušaj poziva nepostojeće funkcije cancel_all_appointments_for_caretaker
        
        Očekivani rezultat: AttributeError ili ImportError
        """
        from appointments import services
        
        with self.assertRaises(AttributeError):
            services.cancel_all_appointments_for_caretaker()

    def test_nonexistent_service_parameter(self):
        """
        ISPITNI SLUČAJ 29: Nepostojeća funkcionalnost - poziv funkcije s nepostojećim parametrom
        
        Ulazni podaci:
        - poziv create_appointment_request s nepostojećim parametrom 'priority'
        
        Očekivani rezultat: TypeError iznimka
        """
        caretaker_user = User.objects.create_user(
            email='test_param@example.com',
            password='testpass123',
            first_name='Test',
            last_name='Param'
        )
        caretaker = Caretaker.objects.create(user=caretaker_user)
        
        student_user = User.objects.create_user(
            email='student_param@example.com',
            password='testpass123',
            first_name='Student',
            last_name='Param'
        )
        Student.objects.create(user=student_user)
        
        start_time = timezone.now() + timedelta(days=1)
        
        with self.assertRaises(TypeError):
            create_appointment_request(
                student_user=student_user,
                caretaker_obj=caretaker,
                requested_start=start_time,
                message="Test",
                priority="high"  # This parameter doesn't exist!
            )

    def test_create_appointment_request_persists_ai_context_when_provided(self):
        caretaker_user = User.objects.create_user(
            email='test_ai_context@example.com',
            password='testpass123',
            first_name='Test',
            last_name='Caretaker'
        )
        caretaker = Caretaker.objects.create(user=caretaker_user)

        student_user = User.objects.create_user(
            email='student_ai_context@example.com',
            password='testpass123',
            first_name='Student',
            last_name='Context'
        )
        Student.objects.create(user=student_user)

        start_time = timezone.now() + timedelta(days=1)
        req = create_appointment_request(
            student_user=student_user,
            caretaker_obj=caretaker,
            requested_start=start_time,
            message="Volio/la bih razgovarati o tome kako se nosim sa stresom.",
            ai_summary="Student opisuje izražen stres i traži prvi razgovor s psihologom.",
            ai_category="Stres i akademski pritisci",
            crisis_flag=False,
            ai_transcript_shared=True,
            ai_transcript_snapshot=[
                {"sender": "student", "content": "Ne znam odakle krenuti.", "sequence": 1},
            ],
        )

        req.refresh_from_db()
        self.assertEqual(req.ai_summary, "Student opisuje izražen stres i traži prvi razgovor s psihologom.")
        self.assertEqual(req.ai_category, "Stres i akademski pritisci")
        self.assertTrue(req.ai_transcript_shared)
        self.assertEqual(len(req.ai_transcript_snapshot), 1)


class ConferenceLinkExtractionTest(TestCase):
    def test_extracts_video_entrypoint_when_not_first(self):
        result = {
            "conferenceData": {
                "entryPoints": [
                    {"entryPointType": "phone", "uri": "tel:+385123456"},
                    {"entryPointType": "video", "uri": "https://meet.google.com/abc-defg-hij"},
                ]
            }
        }

        self.assertEqual(
            extract_conference_link(result),
            "https://meet.google.com/abc-defg-hij",
        )

    def test_prefers_hangout_link_when_present(self):
        result = {
            "hangoutLink": "https://meet.google.com/from-hangout-link",
            "conferenceData": {
                "entryPoints": [
                    {"entryPointType": "video", "uri": "https://meet.google.com/from-entry-point"},
                ]
            },
        }

        self.assertEqual(
            extract_conference_link(result),
            "https://meet.google.com/from-hangout-link",
        )
