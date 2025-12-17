from django.contrib.auth import get_user_model, authenticate
from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status

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
import jwt
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from .serializers import EmailOnlySerializer, RegistrationConfirmSerializer
from django.db import transaction


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
    """Accepts `{ "email": "..." }`. If email is unused, prints a JWT to server console (for now).

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
        payload = {
            'email': email,
            'iat': int(now.timestamp()),
            'exp': int((now + timedelta(seconds=expiry_seconds)).timestamp())
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')

        # PRINT U KONZOLU i cijeli link za frontend s tokenom
        registration_link = f"{settings.FRONTEND_URL.rstrip('/')}{COMPLETE_REGISTER_PATH}?token={token}"
        print(f"[registration link for {email}]: {registration_link}")

        # PROMJENA
        return Response({"detail": "Registration token generated and printed to server console."})


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
        if User.objects.filter(email__iexact=email).exists():
            return Response({"error": "Mail je vec registriran"}, status=status.HTTP_400_BAD_REQUEST)

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