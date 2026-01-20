from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from accounts.models import User, Student, Caretaker
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
