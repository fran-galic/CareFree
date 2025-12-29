"""URL routes for the calendar_integration app."""

from django.urls import path

from .views import CalendarEventList, CreateEventView, SyncNowView

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
]
