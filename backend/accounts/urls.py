from django.urls import path
from .views import ConfirmRegistrationView, LoginView, RequestRegistrationTokenView, deleteUserView, logoutView, refresh_access_token_view, requestPasswordResetView, resetPasswordConfirmView


urlpatterns = [
    path('login/', LoginView.as_view(), name="login"),
    path('logout/', logoutView, name="logout-user"),
    path('delete/', deleteUserView, name="delete-user"),
    path('forgot-password/', requestPasswordResetView, name="forgot-password"),
    path('reset-password/<str:uidb64>/<str:token>/', resetPasswordConfirmView, name="reset-password"),
    path('refresh/', refresh_access_token_view, name="refresh_token"),

    path('register/request-email/', RequestRegistrationTokenView.as_view(), name='request_registration_token'),
    path('register/confirm/', ConfirmRegistrationView.as_view(), name='confirm_registration'),
]
