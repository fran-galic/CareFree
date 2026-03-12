from django.contrib.auth import get_user_model, authenticate
from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status

from accounts.permissions import IsCaretaker
from rest_framework.parsers import FormParser, MultiPartParser

from .models import Caretaker, Student
from .serializers import (
    LoginSerializer,
    UserSerializer,
    CaretakerSearchSerializer,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken, UntypedToken, BlacklistedToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import TokenError

from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
import jwt
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from .serializers import EmailOnlySerializer, RegistrationConfirmSerializer
from django.db import transaction

#Imports za google oauth
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests


from .serializers import (
    CaretakerCVSerializer,
    DiplomaSerializer,
    CaretakerProfileSerializer,
    CaretakerImageSerializer,
)
from .models import CaretakerCV, Diploma, HelpCategory, Certificate
from .serializers import CertificateSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import ListAPIView
from backend.emailing import render_branded_email, send_project_email


User = get_user_model()


def _versioned_image_url(image_field):
    if not image_field:
        return None

    try:
        url = image_field.url
    except Exception:
        return None

    try:
        storage_name = image_field.storage.__class__.__name__.lower()
        if "filesystemstorage" not in storage_name:
            return url
        modified_at = image_field.storage.get_modified_time(image_field.name)
        version = int(modified_at.timestamp())
        separator = "&" if "?" in url else "?"
        return f"{url}{separator}v={version}"
    except Exception:
        return url


def _serialize_auth_user(user):
    return {
        **UserSerializer(user).data,
        "auth_provider": "google" if getattr(user, "google_sub", None) else "password",
        "needs_onboarding": not bool(getattr(user, "role", None)),
    }


def build_auth_response(user, *, status_code=200, extra_data=None):
    """Return a Response containing JWT tokens and set auth cookies for a given user."""
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token

    payload = {
        "user": _serialize_auth_user(user),
        "refresh": str(refresh),
        "access": str(access),
    }
    if extra_data:
        payload.update(extra_data)

    response = Response(payload, status=status_code)

    response.set_cookie(
        key="accessToken",
        value=str(access),
        httponly=True,
        secure=False if settings.DEBUG else True,    #True
        samesite='Lax' if settings.DEBUG else 'None',
        path="/",
    )

    response.set_cookie(
        key="refreshToken",
        value=str(refresh),
        httponly=True,
        secure=False if settings.DEBUG else True,    #True
        samesite='Lax' if settings.DEBUG else 'None',
        path="/",
    )

    return response

COMPLETE_REGISTER_PATH = "/accounts/signup"


def _google_onboarding_payload(user):
    needs_onboarding = not bool(getattr(user, "role", None))
    return {
        "auth_flow": "complete_registration" if needs_onboarding else "login",
        "needs_onboarding": needs_onboarding,
        "onboarding_path": COMPLETE_REGISTER_PATH if needs_onboarding else "/carefree/main",
    }


def _split_google_name(userinfo):
    given_name = (userinfo.get("given_name") or "").strip()
    family_name = (userinfo.get("family_name") or "").strip()
    full_name = (userinfo.get("name") or "").strip()

    if given_name or family_name:
        return given_name, family_name

    if not full_name:
        return "", ""

    parts = full_name.split()
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


class RequestRegistrationTokenView(APIView):
    """Accepts `{ "email": "..." }`. Sends an email to complete the registration.

    Edit COMPLETE_REGISTER_PATH to be the frontend's path to complete registration.
    """
    permission_classes = [AllowAny]
    serializer_class = EmailOnlySerializer

    def post(self, request, format=None):
        serializer = self.serializer_class(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].strip()
        existing_user = User.objects.filter(email__iexact=email).first()
        if existing_user:
            if existing_user.google_sub:
                return Response(
                    {"error": "Za ovaj email već postoji Google račun. Prijavite se pomoću gumba 'Google'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response({"error": "Mail je već registriran."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        expiry_seconds = getattr(settings, 'REGISTRATION_TOKEN_EXP_SECONDS', 900)
        expiry_hours = int(expiry_seconds) // 3600 
        payload = {
            'email': email,
            'iat': int(now.timestamp()),
            'exp': int((now + timedelta(seconds=expiry_seconds)).timestamp())
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')

        registration_link = f"{settings.FRONTEND_URL.rstrip('/')}{COMPLETE_REGISTER_PATH}?token={token}"
        #print u konzoli
        print(f"[registration link for {email}]: {registration_link}")

        ctx = {
            'registration_link': registration_link,
            'expiry_hours': expiry_hours,
            'logo_url': f"{settings.FRONTEND_URL.rstrip('/')}/images/logo.png",
            'hero_image_url': f"{settings.FRONTEND_URL.rstrip('/')}/images/for_email.png",
        }
        html_message = render_to_string('emails/confirm_registration.html', ctx)
        plain_message = strip_tags(html_message)

        try:
            send_project_email(
                subject="Dovršite registraciju na CareFree",
                message=plain_message,
                recipient_list=[email],
                html_message=html_message,
                fail_silently=False,
            )
        except Exception as e:
            return Response({"error": "Slanje emaila nije uspjelo."}, status=500)

        return Response({"detail": "Poslali smo link za dovršetak registracije na Vaš email."})
    


class ConfirmRegistrationView(APIView):
    """Confirm registration using token and create user + role-specific object."""
    permission_classes = [AllowAny]
    serializer_class = RegistrationConfirmSerializer

    def post(self, request, format=None):
        serializer = self.serializer_class(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        token = data.get('token')
        user = None
        email = None

        if token:
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            except jwt.ExpiredSignatureError:
                return Response({"error": "Token je istekao."}, status=status.HTTP_400_BAD_REQUEST)
            except jwt.InvalidTokenError:
                return Response({"error": "Neispravan token."}, status=status.HTTP_400_BAD_REQUEST)

            email = payload.get('email')
            if not email:
                return Response({"error": "Token ne sadrži email."}, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.filter(email__iexact=email).first()
        elif request.user.is_authenticated and getattr(request.user, "google_sub", None) and not getattr(request.user, "role", None):
            user = request.user
            email = user.email
        else:
            return Response(
                {"error": "Nedostaje valjan registracijski token ili aktivna Google prijava za dovršetak registracije."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user is None:
            password = data.get("password")
            if not password:
                return Response({"error": "Lozinka je obavezna."}, status=status.HTTP_400_BAD_REQUEST)
                        
            try:
                with transaction.atomic():
                    user = User.objects.create_user(
                        email=email,
                        password=data['password'],
                        first_name=data['first_name'],
                        last_name=data['last_name'],
                        role=data['role'],
                    )

                    if data['role'] == 'caretaker':
                        Caretaker.objects.create(user=user)
                    else:
                        Student.objects.create(user=user)

            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

            return Response(
                {
                    "detail": "Registracija uspješna.",
                    "user": _serialize_auth_user(user),
                },
                status=status.HTTP_201_CREATED,
            )
        

        if user.google_sub is None:
            return Response({"error": "Za ovaj email već postoji račun prijavljen lozinkom. Prijavite se lozinkom ili resetirajte lozinku."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                user.first_name = data["first_name"]
                user.last_name = data["last_name"]
                user.role = data["role"]
                password = data.get("password")
                if password:
                    user.set_password(password)
                user.save()

                if data["role"] == "caretaker":
                    Caretaker.objects.get_or_create(user=user)
                else:
                    Student.objects.get_or_create(user=user)
                
                response = build_auth_response(
                    user,
                    extra_data=_google_onboarding_payload(user),
                )
                return response


        except Exception as e:
            return Response({"error": str(e)}, status=400)



    
    
class LoginView(generics.CreateAPIView):
    serializer_class = LoginSerializer
    permission_classes=[AllowAny]

    def post(self, request, *args, **kwargs):
        email = (request.data.get("email") or "").strip()
        password = request.data.get("password")

        if not email or not password:
            return Response({"error": "Email i lozinka su obavezni."}, status=400)

        user = authenticate(request, email=email, password=password)

        if not user:
            existing_user = User.objects.filter(email__iexact=email).first()
            if existing_user and existing_user.google_sub and not existing_user.has_usable_password():
                return Response(
                    {"error": "Za ovaj račun koristite Google prijavu ili prvo postavite lozinku kroz dovršetak registracije."},
                    status=400,
                )
            return Response({"error": "Neispravan email ili lozinka."}, status=400)
        
        return build_auth_response(user)
    
@api_view(['POST'])
@permission_classes([AllowAny])
def loginOrRegisterWithWGogleView(request):
    access_token = request.data.get("access_token")
    
    if not access_token:
        return Response(
            {"error": "access_token nije poslan"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        
        import requests as python_requests
        userinfo_response = python_requests.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        
        if userinfo_response.status_code != 200:
            return Response(
                {"error": "Neuspješna verifikacija Google tokena"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        userinfo = userinfo_response.json()
        google_sub = userinfo.get("id")
        email = (userinfo.get("email") or "").strip().lower()
        email_verified = bool(userinfo.get("verified_email"))
        first_name, last_name = _split_google_name(userinfo)

        if not google_sub:
            return Response(
                {"error": "Google ID nije pronađen"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if not email or not email_verified:
            return Response(
                {"error": "Google račun mora imati potvrđen email da bi se mogao koristiti za prijavu."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

    except Exception as e:
        print(f"Google OAuth error: {e}")
        return Response(
            {"error": "Greška pri verifikaciji Google tokena"},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    user = User.objects.filter(google_sub=google_sub).first()
    existing_email_user = User.objects.filter(email__iexact=email).first()

    if user is None and existing_email_user and not existing_email_user.google_sub:
        return Response(
            {
                "error": "Za ovaj email već postoji račun prijavljen lozinkom. Prijavite se lozinkom ili resetirajte lozinku prije povezivanja Google računa."
            },
            status=status.HTTP_409_CONFLICT,
        )

    if user is None and existing_email_user and existing_email_user.google_sub and existing_email_user.google_sub != google_sub:
        return Response(
            {
                "error": "Ovaj email je već povezan s drugim Google računom. Prijavite se ispravnim Google računom."
            },
            status=status.HTTP_409_CONFLICT,
        )

    if user is None:
        user = User.objects.create_user(
            email=email,
            password=None,
            first_name=first_name or email.split("@")[0],
            last_name=last_name,
            google_sub=google_sub,
        )
    else:
        updated = False
        if user.email != email:
            user.email = email
            updated = True
        if first_name and user.first_name != first_name:
            user.first_name = first_name
            updated = True
        if last_name and user.last_name != last_name:
            user.last_name = last_name
            updated = True
        if updated:
            user.save()

    return build_auth_response(
        user,
        extra_data=_google_onboarding_payload(user),
    )



class CaretakerCompleteRegistrationView(APIView):
    serializer_class = CaretakerProfileSerializer
    permission_classes = [IsCaretaker, IsAuthenticated]

    def _serialize_profile(self, caretaker, user):
        serializer = self.serializer_class(caretaker)
        data = serializer.data

        image_url = _versioned_image_url(getattr(caretaker, 'image', None))
        image_mime = getattr(caretaker, 'image_mime_type', None)

        try:
            cv = caretaker.cv
            cv_name = cv.original_filename or getattr(cv.file, 'name', None)
            cv_data = {
                'id': cv.id,
                'filename': cv_name,
            }
        except Exception:
            cv_name = None
            cv_data = None

        diploma_names = []
        diploma_files = []
        try:
            for d in caretaker.diplomas.all():
                filename = d.original_filename or getattr(d.file, 'name', None)
                diploma_names.append(filename)
                diploma_files.append({'id': d.id, 'filename': filename})
        except Exception:
            diploma_names = []
            diploma_files = []

        certificate_names = []
        certificate_files = []
        try:
            for c in caretaker.certificates.all():
                filename = c.original_filename or getattr(c.file, 'name', None)
                certificate_names.append(filename)
                certificate_files.append({'id': c.id, 'filename': filename})
        except Exception:
            certificate_names = []
            certificate_files = []

        data['image'] = image_url
        data['image_mime_type'] = image_mime
        data['cv_filename'] = cv_name
        data['cv_file'] = cv_data
        data['diploma_filenames'] = diploma_names
        data['diploma_files'] = diploma_files
        data['certificate_filenames'] = certificate_names
        data['certificate_files'] = certificate_files
        data['age'] = getattr(user, 'age', None)

        return data

    def get(self, request):
        caretaker = request.user.caretaker

        return Response(self._serialize_profile(caretaker, request.user))

    def post(self, request):
        caretaker = request.user.caretaker
        serializer = self.serializer_class(caretaker, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        # require all registration fields to be provided in this request
        def has_value(v):
            if v is None:
                return False
            if isinstance(v, str):
                return bool(v.strip())
            try:
                # file-like upload (UploadedFile) or list/tuple/set-like
                if hasattr(v, 'name'):
                    return True
                return len(v) > 0
            except Exception:
                return True

        req = request.data
        missing = []
        # Note: image, CV, and diplomas are uploaded separately via dedicated endpoints
        # so we don't check for them in this request
        if not has_value(req.get('tel_num')):
            missing.append('tel_num')
        if not has_value(req.get('about_me')):
            missing.append('about_me')
        if not has_value(req.get('help_categories')):
            missing.append('help_categories')
    
        if missing:
            return Response({
                'error': 'Missing required fields',
                'missing_fields': missing,
            }, status=400)

        serializer.save()

        # evaluate profile completeness using model helper and save
        # this will check for image, CV, and diplomas
        try:
            caretaker.is_profile_complete = caretaker.is_complete()
        except Exception:
            caretaker.is_profile_complete = False
        caretaker.save()

        # Return helpful feedback if profile is incomplete
        response_data = self._serialize_profile(caretaker, request.user)
        # include uploaded filenames and image metadata for client convenience
        # try:
        #     cv = caretaker.cv
        #     cv_name = cv.original_filename or getattr(cv.file, 'name', None)
        # except Exception:
        #     cv_name = None

        # diploma_names = []
        # try:
        #     for d in caretaker.diplomas.all():
        #         diploma_names.append(d.original_filename or getattr(d.file, 'name', None))
        # except Exception:
        #     diploma_names = []

        # certificate_names = []
        # try:
        #     for c in caretaker.certificates.all():
        #         certificate_names.append(c.original_filename or getattr(c.file, 'name', None))
        # except Exception:
        #     certificate_names = []

        # try:
        #     image_url = getattr(caretaker.image, 'url', None)
        # except Exception:
        #     image_url = None
        # image_mime = getattr(caretaker, 'image_mime_type', None)

        # response_data['cv_filename'] = cv_name
        # response_data['diploma_filenames'] = diploma_names
        # response_data['certificate_filenames'] = certificate_names
        # response_data['image'] = image_url
        # response_data['image_mime_type'] = image_mime
        
        if not caretaker.is_profile_complete:
            missing_items = []
            try:
                if not (caretaker.image and getattr(caretaker.image, 'name', None)):
                    missing_items.append('profilna slika')
            except Exception:
                missing_items.append('profilna slika')
            
            try:
                if not hasattr(caretaker, 'cv'):
                    missing_items.append('CV')
            except Exception:
                missing_items.append('CV')
            
            try:
                if not caretaker.diplomas.exists():
                    missing_items.append('diploma')
            except Exception:
                missing_items.append('diploma')
            
            if missing_items:
                response_data['incomplete_reason'] = f"Nedostaje: {', '.join(missing_items)}"

        return Response(response_data)
    
    def patch(self, request):
        caretaker = request.user.caretaker
        serializer = self.serializer_class(caretaker, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save()
        caretaker.save()

        return Response(self._serialize_profile(caretaker, request.user))

from drf_spectacular.utils import extend_schema

@extend_schema(
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'file': {
                    'type': 'string',
                    'format': 'binary',
                }
            },
            'required': ['file'],
        }
    }
)
class CaretakerCVUploadView(APIView):
    permission_classes = [IsAuthenticated, IsCaretaker]
    serializer_class = CaretakerCVSerializer
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        caretaker = request.user.caretaker

        serializer = self.serializer_class(data=request.data, context={'caretaker': caretaker})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        obj = serializer.save()

        return Response({'message': 'CV uploaded successfully'})

    def delete(self, request):
        caretaker = request.user.caretaker
        try:
            caretaker.cv.delete()
        except CaretakerCV.DoesNotExist:
            return Response({'error': 'CV nije pronađen.'}, status=404)
        return Response({'message': 'CV deleted successfully'})


@extend_schema(
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'file': {
                    'type': 'string',
                    'format': 'binary',
                },
                # 'diploma_type': {
                #     'type': 'string',
                #     'enum': ['DEGREE', 'CERTIFICATE', 'LICENSE']
                # },
            },
            'required': ['file'],
        }
    }
)
class DiplomaCreateView(APIView):
    permission_classes = [IsAuthenticated, IsCaretaker]
    serializer_class = DiplomaSerializer
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        caretaker = request.user.caretaker

        serializer = self.serializer_class(data=request.data, context={'caretaker': caretaker})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        obj = serializer.save()

        return Response({'message': 'Diploma uploaded successfully'})

    def delete(self, request, diploma_id):
        diploma = Diploma.objects.filter(id=diploma_id, caretaker=request.user.caretaker).first()
        if not diploma:
            return Response({'error': 'Diploma nije pronađena.'}, status=404)

        diploma.delete()
        return Response({'message': 'Diploma deleted successfully'})


@extend_schema(
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'file': {
                    'type': 'string',
                    'format': 'binary',
                },
            },
            'required': ['file'],
        }
    }
)
class CertificateCreateView(APIView):
    permission_classes = [IsAuthenticated, IsCaretaker]
    serializer_class = CertificateSerializer
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        caretaker = request.user.caretaker

        serializer = self.serializer_class(data=request.data, context={'caretaker': caretaker})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        obj = serializer.save()

        return Response({'message': 'Certificate uploaded successfully'})

    def delete(self, request, certificate_id):
        certificate = Certificate.objects.filter(id=certificate_id, caretaker=request.user.caretaker).first()
        if not certificate:
            return Response({'error': 'Certifikat nije pronađen.'}, status=404)

        certificate.delete()
        return Response({'message': 'Certificate deleted successfully'})


@extend_schema(
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'image': {
                    'type': 'string',
                    'format': 'binary',
                }
            },
            'required': ['image'],
        }
    }
)
class CaretakerImageUploadView(APIView):
    permission_classes = [IsAuthenticated, IsCaretaker]
    serializer_class = CaretakerImageSerializer
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        caretaker = request.user.caretaker

        serializer = self.serializer_class(data=request.data, context={'caretaker': caretaker})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        obj = serializer.save()

        return Response({'message': 'Image uploaded successfully'})

    def delete(self, request):
        caretaker = request.user.caretaker
        if not caretaker.image:
            return Response({'error': 'Profilna slika nije pronađena.'}, status=404)

        caretaker.image = None
        caretaker.image_mime_type = None
        caretaker.save()
        return Response({'message': 'Image deleted successfully'})

    
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logoutView(request):
    try:
        refresh_token = request.COOKIES.get("refreshToken")
        token = RefreshToken(refresh_token)
        token.blacklist()
    except:
        pass

    response = Response({"message": "Uspješno odjavljen"}, status=200)
    response.delete_cookie(
        key="accessToken",
        samesite='Lax' if settings.DEBUG else 'None',
        path="/",
        )
    response.delete_cookie(
        key="refreshToken",
        samesite='Lax' if settings.DEBUG else 'None',
        path="/",
        )
    return response


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def deleteUserView(request):
    # if request.user.id != user_id and not (request.user.is_staff or request.user.is_superuser):
    #     return Response({"error": "Normalan korisnik može obrisati samo svoj račun."}, status=403)
    try:
        user = User.objects.get(id=request.user.id)
    except User.DoesNotExist:
        return Response({"error": "Korisnik ne postoji"}, status=404)
    
    user.delete()
    return Response({"message": "Korisnik uspješno izbrisan"}, status=204)



@api_view(['POST'])
@permission_classes([AllowAny])
def requestPasswordResetView(request):
    email = request.data.get("email")

    if not email:
        return Response({"error": "Molim upisati ispravan email"}, status=400)
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({"error": "Korisnik s ovim emailom ne postoji"}, status=404)
    
    token = default_token_generator.make_token(user)

    uid = urlsafe_base64_encode(force_bytes(user.id))
    
    reset_link = f"{settings.FRONTEND_URL}/auth/reset-password/{uid}/{token}/"

    html_message, plain_message = render_branded_email(
        title="Resetiraj svoju lozinku",
        intro="Zaprimili smo zahtjev za promjenu lozinke za tvoj CareFree račun.",
        body_lines=[
            "Ako si ti zatražio/la promjenu, klikni na donji gumb i postavi novu lozinku.",
            "Ako nisi tražio/la reset lozinke, slobodno ignoriraj ovu poruku.",
        ],
        action_label="Resetiraj lozinku",
        action_url=reset_link,
        recipient_name=user.first_name or user.email,
    )

    send_project_email(
        subject="Resetiraj svoju lozinku - CareFree",
        message=plain_message,
        recipient_list=[email],
        html_message=html_message,
    )

    return Response({"message": "Poslali smo link za resetiranje svog passworda na Vaš email."}, status=200)


@api_view(['POST'])
@permission_classes([AllowAny])
def resetPasswordConfirmView(request, uidb64, token):
    password = request.data.get("password")
    repeatPassword = request.data.get("repeatPassword")

    if not password or not repeatPassword:
        return Response({"error": "Potrebno je upisati lozinke."}, status=400)
    
    if password != repeatPassword:
        return Response({"error": "Lozinke se ne podudaraju."}, status=400)
    
    if len(password) < 6:
        return Response({"error": "Lozinka mora sadržavati barem 6 znakova"}, status=400)
    
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        user = User.objects.get(id=uid)
    except Exception:
        return Response({"error": "Neispravan link."}, status=400)
    
    if not default_token_generator.check_token(user, token):
        return Response({"error": "Token nije valjan ili je istekao"}, status=400)
    
    if user.check_password(password):
        return Response({"error": "Nova lozinka ne može biti ista kao stara lozinka."}, status=400)
    
    user.set_password(password)
    user.save()

    response = Response({"message": "Lozinka je uspješno resetirana."}, status=200) 
    response.delete_cookie(
        key="accessToken",
        samesite='Lax' if settings.DEBUG else 'None',
        path="/",
        )
    response.delete_cookie(
        key="refreshToken",
        samesite='Lax' if settings.DEBUG else 'None',
        path="/",
        )
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_access_token_view(request):
    refresh_token = request.COOKIES.get("refreshToken")
    if not refresh_token:
        return Response({"error": "Refresh token nije pronađen"}, status=401)
    
    serializer = TokenRefreshSerializer(data={"refresh": refresh_token})

    try:
        serializer.is_valid(raise_exception=True)

    except TokenError:
        response = Response({"error": "Neispravan ili istekao refresh token"}, status=401)
        response.delete_cookie(
            key="accessToken",
            samesite='Lax' if settings.DEBUG else 'None',
            path="/",
        )
        response.delete_cookie(
            key="refreshToken",
            samesite='Lax' if settings.DEBUG else 'None',
            path="/",
        )
        return response
    
    new_access = serializer.validated_data.get("access")
    new_refresh = serializer.validated_data.get("refresh", None)

    response = Response({"access": new_access})

    response.set_cookie(
        key="accessToken",
        value=new_access,
        httponly=True,
        secure=False if settings.DEBUG else True,    #True
        samesite='Lax' if settings.DEBUG else 'None',
        path="/",
    )

    if new_refresh:
        response.set_cookie(
            key="refreshToken",
            value=new_refresh,
            httponly=True,
            secure=False if settings.DEBUG else True,    #True
            samesite='Lax' if settings.DEBUG else 'None',
            path="/",
        )

    return response


class CaretakerSearchView(generics.ListAPIView):
    """
    View for students to search approved caretakers
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CaretakerSearchSerializer
    
    def get_queryset(self):
        queryset = Caretaker.objects.filter(is_approved=True, approval_status='APPROVED')
        
        # Optional search by name
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                user__first_name__icontains=search
            ) | queryset.filter(
                user__last_name__icontains=search
            )
        
        return queryset.select_related('user').order_by('user__first_name')


class StudentCompleteRegistrationView(APIView):
    """
    Complete student registration by adding studying_at, year_of_study, and sex.
    This endpoint does not require authentication as it's part of the signup flow.
    """
    permission_classes = [AllowAny]

    def post(self, request, format=None):
        user_id = request.data.get('user_id')
        studying_at = request.data.get('studying_at')
        year_of_study = request.data.get('year_of_study')
        sex = request.data.get('sex')
        age = request.data.get('age')

        if not user_id:
            return Response({'error': 'user_id je obavezan.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Korisnik nije pronađen.'}, status=status.HTTP_404_NOT_FOUND)

        
        if sex:
            user.sex = sex
        if age:
            user.age = age
        user.save()

        try:
            student = user.student
            if studying_at:
                student.studying_at = studying_at
            if year_of_study:
                student.year_of_study = year_of_study
            student.save()
        except Student.DoesNotExist:
            return Response({'error': 'Student profil ne postoji.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'detail': 'Student profil uspješno dovršen.',
            'user_id': user.id
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def debug_s3_config(request):
    """Debug view to check S3/B2 configuration"""
    from django.conf import settings
    
    return Response({
        'AWS_ACCESS_KEY_ID': bool(settings.AWS_ACCESS_KEY_ID),
        'AWS_SECRET_ACCESS_KEY': bool(settings.AWS_SECRET_ACCESS_KEY),
        'BUCKET': settings.AWS_STORAGE_BUCKET_NAME,
        'ENDPOINT': settings.AWS_S3_ENDPOINT_URL,
        'REGION': getattr(settings, 'AWS_S3_REGION_NAME', None),
    })
