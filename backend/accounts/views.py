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
from django.core.mail import send_mail
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


User = get_user_model()


def build_auth_response(user):
    """Return a Response containing JWT tokens and set auth cookies for a given user."""
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token

    response = Response({
        "user": UserSerializer(user).data,
        "refresh": str(refresh),
        "access": str(access),
    })

    response.set_cookie(
        key="accessToken",
        value=str(access),
        httponly=True,
        secure=False,    #True
        samesite='Lax',
        path="/",
    )

    response.set_cookie(
        key="refreshToken",
        value=str(refresh),
        httponly=True,
        secure=False,    #True
        samesite='Lax',
        path="/",
    )

    return response

COMPLETE_REGISTER_PATH = "/accounts/signup"


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
        if User.objects.filter(email__iexact=email).exists():
            return Response({"error": "Mail je vec registriran"}, status=status.HTTP_400_BAD_REQUEST)

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
        }
        html_message = render_to_string('emails/confirm_registration.html', ctx)
        plain_message = strip_tags(html_message)

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', None) or 'carefree@support.hr'
        try:
            send_mail(
                subject="Dovršite registraciju na CareFree",
                message=plain_message,
                from_email=from_email,
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
        token = data['token']
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return Response({"error": "Token je istekao."}, status=status.HTTP_400_BAD_REQUEST)
        except jwt.InvalidTokenError:
            return Response({"error": "Neispravan token."}, status=status.HTTP_400_BAD_REQUEST)

        email = payload.get('email')
        if not email:
            return Response({"error": "Token ne sadrzi email."}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
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

            return Response({"detail": "Registracija uspješna."}, status=status.HTTP_201_CREATED)
        

        if user.google_sub is None:
            return Response({"error": "Mail je vec registriran."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                # upiši podatke (ako želiš: samo ako su prazni)
                user.first_name = data["first_name"]
                user.last_name = data["last_name"]
                user.role = data["role"]
                user.save()

                # osiguraj da postoji profil
                if data["role"] == "caretaker":
                    Caretaker.objects.create(user=user)
                else:
                    Student.objects.create(user=user)
                
                response = build_auth_response(user)
                return response
                #return Response({"detail": "Profil dovršen."}, status=200)


        except Exception as e:
            return Response({"error": str(e)}, status=400)



    
    
class LoginView(generics.CreateAPIView):
    serializer_class = LoginSerializer
    permission_classes=[AllowAny]

    def post(self, request, *args, **kwargs):
        email = request.data.get("email")
        password=request.data.get("password")

        user = authenticate(request, email=email, password=password)

        if not user:
            return Response({"error": "Neispravno korisničko ime ili lozinka"}, status=400)
        
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
        email = userinfo.get("email")
        name = userinfo.get("name", "")

        if not google_sub:
            return Response(
                {"error": "Google ID nije pronađen"},
                status=status.HTTP_401_UNAUTHORIZED
            )

    except Exception as e:
        print(f"Google OAuth error: {e}")
        return Response(
            {"error": "Greška pri verifikaciji Google tokena"},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    
    user, created = User.objects.get_or_create(
        google_sub=google_sub,
        defaults={"email": email or "", "first_name": name},
    )

    # novi user bez rolea
    if created or user.role is None:
        now = timezone.now()
        expiry_seconds = getattr(settings, 'REGISTRATION_TOKEN_EXP_SECONDS', 900)
        payload = {
            'email': email,
            'iat': int(now.timestamp()),
            'exp': int((now + timedelta(seconds=expiry_seconds)).timestamp())
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
        registration_link = f"{settings.FRONTEND_URL.rstrip('/')}{COMPLETE_REGISTER_PATH}?token={token}"
        print(f"[registration link for {email}]: {registration_link}")

        expiry_hours = int(expiry_seconds) // 3600
        ctx = {
            'registration_link': registration_link,
            'expiry_hours': expiry_hours,
        }
        html_message = render_to_string('emails/confirm_registration.html', ctx)
        plain_message = strip_tags(html_message)

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', None) or 'carefree@support.hr'
        try:
            send_mail(
                subject="Dovršite registraciju na CareFree",
                message=plain_message,
                from_email=from_email,
                recipient_list=[email],
                html_message=html_message,
                fail_silently=False,
            )
        except Exception as e:
            print(f"Email sending error: {e}")
            return Response({"error": "Slanje emaila nije uspjelo."}, status=500)

        return Response({
            "detail": "Poslali smo link za dovršetak registracije na Vaš email.",
            "email": email
        })
    
    
    response = build_auth_response(user)
    
    
    updated = False
    if email and user.email != email:
        user.email = email
        updated = True
    if name and getattr(user, "first_name", "") != name:
        user.first_name = name
        updated = True
    if updated:
        user.save()
    
    return response



class CaretakerCompleteRegistrationView(APIView):
    serializer_class = CaretakerProfileSerializer
    permission_classes = [IsCaretaker, IsAuthenticated]

    def get(self, request):
        caretaker = request.user.caretaker
        serializer = self.serializer_class(caretaker)
        data = serializer.data

        try:
            image_url = getattr(caretaker.image, 'url', None)
        except Exception:
            image_url = None
        image_mime = getattr(caretaker, 'image_mime_type', None)

        try:
            cv = caretaker.cv
            cv_name = cv.original_filename or getattr(cv.file, 'name', None)
        except Exception:
            cv_name = None

        diploma_names = []
        try:
            for d in caretaker.diplomas.all():
                diploma_names.append(d.original_filename or getattr(d.file, 'name', None))
        except Exception:
            diploma_names = []

        certificate_names = []
        try:
            for c in caretaker.certificates.all():
                certificate_names.append(c.original_filename or getattr(c.file, 'name', None))
        except Exception:
            certificate_names = []

        data['image'] = image_url
        data['image_mime_type'] = image_mime
        data['cv_filename'] = cv_name
        data['diploma_filenames'] = diploma_names
        data['certificate_filenames'] = certificate_names

        return Response(data)

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
        response_data = CaretakerProfileSerializer(caretaker).data
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

        return Response(CaretakerProfileSerializer(caretaker).data)

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
    response.delete_cookie("accessToken")
    response.delete_cookie("refreshToken")
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

    send_mail(
        subject="Resetiraj svoju lozinku - CareFree",
        message=f"Klikni na link da promijeniš svoju lozinku:\n{reset_link}",
        from_email="carefree_reset_pass@gmail.com",
        recipient_list=[email],
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
    response.delete_cookie("accessToken")
    response.delete_cookie("refreshToken")
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
        response.delete_cookie("accessToken")
        response.delete_cookie("refreshToken")
        return response
    
    new_access = serializer.validated_data.get("access")
    new_refresh = serializer.validated_data.get("refresh", None)

    response = Response({"access": new_access})

    response.set_cookie(
        key="accessToken",
        value=new_access,
        httponly=True,
        secure=False,
        samesite="Lax",
        path="/",
    )

    if new_refresh:
        response.set_cookie(
            key="refreshToken",
            value=new_refresh,
            httponly=True,
            secure=False,
            samesite="Lax",
            path="/",
        )

    return response