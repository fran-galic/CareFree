from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from accounts.models import User, Student
from accounts.validators import validate_file_type_and_size
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()


class UserModelTest(TestCase):
    """
    Test Case 1: Testiranje User modela
    Opis: Testira se kreiranje korisnika i validacija osnovnih polja
    """

    def test_create_user_regular_case(self):
        """
        ISPITNI SLUČAJ 1: Redovan slučaj - kreiranje korisnika s valjanim podacima
        
        Ulazni podaci:
        - email: test@example.com
        - password: testpass123
        - first_name: Ana
        - last_name: Horvat
        - age: 25
        
        Očekivani rezultat: Korisnik se uspješno kreira i spremnik u bazu podataka
        """
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='Ana',
            last_name='Horvat',
            age=25
        )
        self.assertEqual(user.email, 'test@example.com')
        self.assertEqual(user.first_name, 'Ana')
        self.assertEqual(user.last_name, 'Horvat')
        self.assertEqual(user.age, 25)
        self.assertTrue(user.check_password('testpass123'))

    def test_create_user_boundary_age_exceeds_max(self):
        """
        ISPITNI SLUČAJ 2: Rubni uvjet - prekoračenje maksimalne starosti
        
        Ulazni podaci:
        - email: toolld@example.com
        - age: 101 (iznad maksimalne dozvoljene vrijednosti)
        
        Očekivani rezultat: ValidationError iznimka
        """
        user = User(
            email='tooold@example.com',
            first_name='Test',
            last_name='User',
            age=101
        )
        with self.assertRaises(ValidationError):
            user.full_clean()

    def test_create_user_without_email_exception(self):
        """
        ISPITNI SLUČAJ 3: Izazivanje iznimke - kreiranje korisnika bez emaila
        
        Ulazni podaci:
        - email: None ili prazan string
        - ostala polja: valjana
        
        Očekivani rezultat: ValueError iznimka
        """
        with self.assertRaises(ValueError):
            User.objects.create_user(email='', password='testpass123')


class StudentModelTest(TestCase):
    """
    Test Case 2: Testiranje Student modela
    """

    def test_create_student_regular_case(self):
        """
        ISPITNI SLUČAJ 4: Redovan slučaj - kreiranje studenta
        
        Ulazni podaci:
        - user: valjan User objekt
        - studying_at: Fakultet elektrotehnike i računarstva
        - year_of_study: 3
        
        Očekivani rezultat: Student se uspješno kreira
        """
        user = User.objects.create_user(
            email='student@fer.hr',
            password='testpass123',
            first_name='Marko',
            last_name='Marković'
        )
        student = Student.objects.create(
            user=user,
            studying_at='Fakultet elektrotehnike i računarstva',
            year_of_study=3
        )
        self.assertEqual(student.user.email, 'student@fer.hr')
        self.assertEqual(student.studying_at, 'Fakultet elektrotehnike i računarstva')
        self.assertEqual(student.year_of_study, 3)
        self.assertTrue(student.is_anonymous)


class FileValidatorTest(TestCase):
    """
    Test Case 3: Testiranje validatora za datoteke
    """

    def test_validate_file_type_pdf_valid(self):
        """
        ISPITNI SLUČAJ 5: Redovan slučaj - validacija PDF datoteke
        
        Ulazni podaci:
        - datoteka: test.pdf (valjani format)
        - veličina: 1MB (unutar limita)
        
        Očekivani rezultat: Validacija prolazi bez iznimke
        """
        pdf_file = SimpleUploadedFile(
            "test.pdf",
            b"fake pdf content",
            content_type="application/pdf"
        )
        try:
            validate_file_type_and_size(pdf_file)
            result = True
        except ValidationError:
            result = False
        self.assertTrue(result)

    def test_validate_file_type_invalid_extension(self):
        """
        ISPITNI SLUČAJ 6: Izazivanje iznimke - nevaljan tip datoteke
        
        Ulazni podaci:
        - datoteka: document.docx (nepodrzan format)
        
        Očekivani rezultat: ValidationError sa porukom o nepodrzanom formatu
        """
        invalid_file = SimpleUploadedFile(
            "document.docx",
            b"fake docx content",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        with self.assertRaises(ValidationError) as context:
            validate_file_type_and_size(invalid_file)
        self.assertIn('Unsupported file extension', str(context.exception))

    def test_validate_file_size_exceeds_limit(self):
        """
        ISPITNI SLUČAJ 7: Rubni uvjet - prevelika datoteka
        
        Ulazni podaci:
        - datoteka: large.pdf
        - veličina: 11MB (iznad limita od 10MB)
        
        Očekivani rezultat: ValidationError sa porukom o prevelikoj datoteci
        """
        large_content = b"x" * (11 * 1024 * 1024)  # 11MB
        large_file = SimpleUploadedFile(
            "large.pdf",
            large_content,
            content_type="application/pdf"
        )
        with self.assertRaises(ValidationError) as context:
            validate_file_type_and_size(large_file)
        self.assertIn('File too large', str(context.exception))


class NonExistentFunctionalityTest(TestCase):
    """
    Test Case 4: Testiranje nepostojećih funkcionalnosti
    """

    def test_user_nonexistent_method(self):
        """
        ISPITNI SLUČAJ 8: Nepostojeća funkcionalnost - poziv neimplementirane metode
        
        Ulazni podaci:
        - user objekt
        - poziv nepostojeće metode get_premium_status()
        
        Očekivani rezultat: AttributeError iznimka
        """
        user = User.objects.create_user(
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )
        with self.assertRaises(AttributeError):
            user.get_premium_status()

    def test_student_nonexistent_property(self):
        """
        ISPITNI SLUČAJ 9: Nepostojeća funkcionalnost - pristup nepostojećem atributu
        
        Ulazni podaci:
        - student objekt
        - pristup nepostojećem atributu gpa (grade point average)
        
        Očekivani rezultat: AttributeError iznimka
        """
        user = User.objects.create_user(
            email='student@example.com',
            password='testpass123',
            first_name='Student',
            last_name='Test'
        )
        student = Student.objects.create(user=user)
        with self.assertRaises(AttributeError):
            _ = student.gpa
