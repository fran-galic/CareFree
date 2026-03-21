from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.base_user import BaseUserManager
from django.core.validators import MaxValueValidator
from django.utils.text import slugify
from .upload_paths import caretaker_image_upload_to, cv_upload_to, diploma_upload_to
from django.core.exceptions import ValidationError

# file validators
from .validators import validate_file_type_and_size, validate_caretaker_image
import mimetypes

class CustomUserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Korisnik mora imati e-mail adresu!")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser mora biti staff")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser mora biti superuser")
        
        return self.create_user(email, password, **extra_fields)


 


class User(AbstractUser):
    MAX_USER_AGE = 100

    first_name = models.CharField(max_length=150, blank=False, null=False)
    last_name = models.CharField(max_length=150, blank=False, null=False)
    email = models.EmailField(unique=True, max_length=200)
    username = models.CharField(max_length=200, null=True, blank=True)

    google_sub = models.CharField(max_length=255, unique=True, null=True, blank=True)

    SEX_CHOICES = [
        ("M", "MALE"),
        ("F", "FEMALE"),
        ("O", "OTHER"),
    ]

    sex = models.CharField(max_length=10, choices=SEX_CHOICES, blank=True, null=True)
    age = models.PositiveIntegerField(validators=[MaxValueValidator(MAX_USER_AGE)], blank=True, null=True)

    datum_registracije = models.DateTimeField(auto_now_add=True)

    ROLE_CHOICES = (
        ("caretaker", "Caretaker"),
        ("student", "Student"),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, blank=True, null=True)


    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email
    
    pass


class Student(models.Model):
    MAX_YEAR_OF_STUDY = 12

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        primary_key=True,
        on_delete=models.CASCADE,
        related_name='student'
    )
    studying_at = models.CharField(max_length=150, blank=True, null=True)
    year_of_study = models.PositiveIntegerField(validators=[MaxValueValidator(MAX_YEAR_OF_STUDY)], blank=True, null=True)
    is_anonymous = models.BooleanField(default=True, help_text="If True, only the student's sex and age will be shown to the caretaker.")

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name}"



class Caretaker(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        primary_key=True,
        on_delete=models.CASCADE,
        related_name='caretaker'
    )

    tel_num = models.CharField(max_length=15, blank=True, null=True)
    show_email_to_students = models.BooleanField(default=False)
    show_phone_to_students = models.BooleanField(default=False)
    image = models.ImageField(upload_to=caretaker_image_upload_to, blank=True, null=True, validators=[validate_caretaker_image])
    image_mime_type = models.CharField(max_length=100, blank=True, null=True)
    about_me = models.TextField(blank=True, max_length=800)
    grad_year = models.PositiveIntegerField(blank=True, null=True, help_text="The year in which the person graduated as a psychologist.")

    help_categories = models.ManyToManyField(
        'HelpCategory', related_name='caretakers', blank=True
    )

    is_profile_complete = models.BooleanField(default=False)

    APPROVAL_PENDING = 'PENDING'
    APPROVAL_APPROVED = 'APPROVED'
    APPROVAL_DENIED = 'DENIED'

    APPROVAL_STATUS_CHOICES = (
        (APPROVAL_PENDING, 'Pending'),
        (APPROVAL_APPROVED, 'Approved'),
        (APPROVAL_DENIED, 'Denied'),
    )

    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default=APPROVAL_PENDING)
    is_approved = models.BooleanField(default=False)

    def is_complete(self):
        # check for uploaded image
        has_image = False
        try:
            img = getattr(self, 'image', None)
            if img and getattr(img, 'name', None):
                has_image = True
        except Exception:
            has_image = False

        return all([
            bool(self.tel_num and str(self.tel_num).strip()),
            has_image,
            bool(self.about_me and str(self.about_me).strip()),
            self.help_categories.exists(),
            CaretakerCV.objects.filter(caretaker=self).exists(),
            self.diplomas.exists(),
        ])

    def save(self, *args, **kwargs):
        # populate image metadata if a new image was uploaded
        try:
            prior_name = None
            if self.pk:
                prior = Caretaker.objects.filter(pk=self.pk).first()
                if prior:
                    prior_name = getattr(prior.image, 'name', None)

            curr_name = getattr(self.image, 'name', None) if getattr(self, 'image', None) else None
            if curr_name and curr_name != prior_name:
                # try to get content_type from uploaded file; fallback to mimetypes
                content_type = None
                try:
                    uploaded_file = getattr(self.image, 'file', None)
                    content_type = getattr(uploaded_file, 'content_type', None)
                except Exception:
                    content_type = None

                if not content_type:
                    content_type = mimetypes.guess_type(curr_name)[0] or ''

                self.image_mime_type = content_type
        except Exception:
            # never fail save due to metadata extraction
            pass

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name}"


class CaretakerCV(models.Model):
    """Single CV per caretaker."""
    caretaker = models.OneToOneField(
        'Caretaker', on_delete=models.CASCADE, related_name='cv'
    )
    file = models.FileField(upload_to=cv_upload_to, validators=[validate_file_type_and_size])
    original_filename = models.CharField(max_length=255, blank=True, null=True)
    mime_type = models.CharField(max_length=100, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"CV for {self.caretaker}"


class Certificate(models.Model):
    caretaker = models.ForeignKey('Caretaker', on_delete=models.CASCADE, related_name='certificates')
    file = models.FileField(upload_to='caretakers/certificates/', validators=[validate_file_type_and_size])
    original_filename = models.CharField(max_length=255, blank=True, null=True)
    mime_type = models.CharField(max_length=100, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Certificate for {self.caretaker}"
    

class Diploma(models.Model):
    # DEGREE = 'DEGREE'
    # CERTIFICATE = 'CERTIFICATE'
    # LICENSE = 'LICENSE'

    # DIPLOMA_TYPE_CHOICES = (
    #     (DEGREE, 'Degree'),
    #     (CERTIFICATE, 'Certificate'),
    #     (LICENSE, 'License'),
    # ) 

    caretaker = models.ForeignKey('Caretaker', on_delete=models.CASCADE, related_name='diplomas')
    file = models.FileField(upload_to=diploma_upload_to, validators=[validate_file_type_and_size])
    # diploma_type = models.CharField(max_length=20, choices=DIPLOMA_TYPE_CHOICES)
    original_filename = models.CharField(max_length=255, blank=True, null=True)
    mime_type = models.CharField(max_length=100, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Diploma for {self.caretaker}"


class HelpCategory(models.Model):
    label = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=60, unique=True, blank=True)
    assistant_code = models.CharField(max_length=16, unique=True, null=True, blank=True)
    description = models.TextField(max_length=200, blank=True, null=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        related_name='subcategories',
        null=True,
        blank=True
    )

    def __str__(self):
        if self.parent:
            return f"{self.parent.label}: {self.label}"
        return self.label

    def save(self, *args, **kwargs):
        # generate slug from label if not present; ensure uniqueness
        if not self.slug:
            self.slug = slugify(self.label)
        super().save(*args, **kwargs)
