from django.urls import path
from .views import CaretakerCVUploadView, CaretakerCompleteRegistrationView, ConfirmRegistrationView, DiplomaCreateView, LoginView, RequestRegistrationTokenView, deleteUserView, logoutView, refresh_access_token_view, requestPasswordResetView, resetPasswordConfirmView
from .views import CaretakerImageUploadView, CertificateCreateView
from .views import loginOrRegisterWithWGogleView


urlpatterns = [
    path('login/', LoginView.as_view(), name="login"),
    path('logout/', logoutView, name="logout-user"),
    path('delete/', deleteUserView, name="delete-user"),
    path('forgot-password/', requestPasswordResetView, name="forgot-password"),
    path('reset-password/<str:uidb64>/<str:token>/', resetPasswordConfirmView, name="reset-password"),
    path('refresh/', refresh_access_token_view, name="refresh_token"),

    path('register/request-email/', RequestRegistrationTokenView.as_view(), name='request_registration_token'),
    path('register/confirm/', ConfirmRegistrationView.as_view(), name='confirm_registration'),
    path('google-login-register/', loginOrRegisterWithWGogleView, name="register-or-login-with-google"),
    # caretaker profile and uploads
    path('caretaker/register/', CaretakerCompleteRegistrationView.as_view(), name='caretaker-profile'),
    path('caretaker/cv/', CaretakerCVUploadView.as_view(), name='caretaker-cv-upload'),
    path('caretaker/diploma/', DiplomaCreateView.as_view(), name='caretaker-diploma-upload'),
    path('caretaker/certificate/', CertificateCreateView.as_view(), name='caretaker-certificate-upload'),
    path('caretaker/image/', CaretakerImageUploadView.as_view(), name='caretaker-image-upload'),
]
