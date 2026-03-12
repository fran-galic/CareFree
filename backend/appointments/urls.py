from django.urls import path
from .views import (
    AppointmentRequestCreateView,
    CaretakerAppointmentRequestListView,
    AppointmentRequestApproveView,
    AppointmentRequestRejectView,
    StudentAppointmentListView,
    StudentAppointmentRequestListView,
    CaretakerAppointmentListView,
    CaretakerSlotsView,
    ToggleAvailabilityView,
    CaretakerAvailabilityBulkSaveView,
    CaretakerMyAvailabilityView,
    MyCalendarView,
    HoldCreateView,
    HoldReleaseView,
)

urlpatterns = [
    path('request/', AppointmentRequestCreateView.as_view(), name='appointment-request'),
    path('caretaker/requests/', CaretakerAppointmentRequestListView.as_view(), name='caretaker-requests'),
    path('caretaker/requests/<int:pk>/approve/', AppointmentRequestApproveView.as_view(), name='appointment-approve'),
    path('caretaker/requests/<int:pk>/reject/', AppointmentRequestRejectView.as_view(), name='appointment-reject'),
    path('student/requests/', StudentAppointmentRequestListView.as_view(), name='student-requests'),
    path('', StudentAppointmentListView.as_view(), name='appointments-list'),
    path('caretaker/', CaretakerAppointmentListView.as_view(), name='appointments-caretaker-list'),
    path('caretaker/slots/', CaretakerSlotsView.as_view(), name='caretaker-slots'),
    path('caretaker/availability/toggle/', ToggleAvailabilityView.as_view(), name='caretaker-availability-toggle'),
    path('caretaker/availability/save/', CaretakerAvailabilityBulkSaveView.as_view(), name='caretaker-availability-save'),
    path('caretaker/availability/my/', CaretakerMyAvailabilityView.as_view(), name='caretaker-my-availability'),
    path('calendar/my/', MyCalendarView.as_view(), name='my-calendar'),
    path('holds/', HoldCreateView.as_view(), name='holds-create'),
    path('holds/<int:pk>/release/', HoldReleaseView.as_view(), name='holds-release'),
]
