"""URL routes for the calendar_integration app."""

from django.urls import path

from .views import CalendarEventList, CreateEventView, SyncNowView, GoogleConnectView, GoogleOAuthCallbackView
from .views import GoogleDisconnectView, GoogleCalendarStatusView, SharedGoogleCalendarStatusView
from .views import SystemGoogleConnectView

urlpatterns = [
    path(
        "events/",
        CalendarEventList.as_view(),
        name="calendar-events",
    ),  # popis eventa iz kalendara
    path(
        "sync-now/",
        SyncNowView.as_view(),
        name="calendar-sync-now",
    ),  # sinkronizacija kalendara
    path(
        "create/",
        CreateEventView.as_view(),
        name="calendar-create-event",
    ),  # stvaranje novog eventa
    path(
        "connect/",
        GoogleConnectView.as_view(),
        name="calendar-google-connect",
    ),
    path(
        "system/connect/",
        SystemGoogleConnectView.as_view(),
        name="calendar-system-google-connect",
    ),
    path(
        "oauth/callback/",
        GoogleOAuthCallbackView.as_view(),
        name="calendar-google-callback",
    ),
    path(
        "disconnect/",
        GoogleDisconnectView.as_view(),
        name="calendar-google-disconnect",
    ),
    path(
        "status/",
        GoogleCalendarStatusView.as_view(),
        name="calendar-google-status",
    ),
    path(
        "shared-status/",
        SharedGoogleCalendarStatusView.as_view(),
        name="calendar-shared-google-status",
    ),
]
