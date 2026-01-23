from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from zoneinfo import ZoneInfo
from datetime import datetime, timedelta, timezone as dt_timezone
from django.utils import timezone

from .permissions import IsStudent
from .serializers import AppointmentRequestSerializer
from .models import AppointmentRequest
from accounts.models import Caretaker
from .services import create_appointment_request
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .permissions import IsCaretaker, OnlyCaretakerCanApprove
from .serializers import AppointmentSerializer
from .models import Appointment
from .services import approve_appointment_request
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .services import get_caretaker_slots, toggle_availability
from .serializers import SlotSerializer
from .permissions import IsStudent
from django.views.decorators.cache import never_cache
from .services import create_hold, release_hold
from rest_framework import permissions


class HoldCreateView(APIView):
    """Create a temporary hold on a slot for the authenticated student."""
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def post(self, request, *args, **kwargs):
        data = request.data
        caretaker_id = data.get('caretaker_id')
        slot_start = data.get('slot_start')
        hold_minutes = int(data.get('hold_minutes') or 10)

        if not caretaker_id or not slot_start:
            return Response({'detail': 'caretaker_id and slot_start required'}, status=status.HTTP_400_BAD_REQUEST)

        caretaker = get_object_or_404(Caretaker, pk=caretaker_id)

        try:
            # parse ISO
            sdt = datetime.fromisoformat(slot_start)
            if sdt.tzinfo is None:
                from zoneinfo import ZoneInfo
                sdt = sdt.replace(tzinfo=ZoneInfo('Europe/Zagreb'))
            # convert to UTC
            sdt_utc = sdt.astimezone(dt_timezone.utc)
        except Exception:
            return Response({'detail': 'Invalid slot_start format'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            hold = create_hold(request.user, caretaker, sdt_utc, hold_minutes=hold_minutes)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'id': hold.id, 'start': hold.start.isoformat(), 'expires_at': hold.expires_at.isoformat(), 'status': hold.status})


class HoldReleaseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        # allow student or caretaker to release (student releases their own hold, caretaker can cancel)
        from .models import ReservationHold
        hold = get_object_or_404(ReservationHold, pk=pk)
        user = request.user
        if hasattr(user, 'student') and hold.student == user.student or hasattr(user, 'caretaker') and hold.caretaker == user.caretaker:
            release_hold(hold)
            return Response({'status': 'released'})
        return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)


class AppointmentRequestCreateView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, *args, **kwargs):
        data = request.data
        caretaker_id = data.get('caretaker_id')
        start_time = data.get('start_time')
        slot_time = data.get('slot_time')
        note = data.get('note') or data.get('message') or ''

        if not caretaker_id or not start_time or not slot_time:
            return Response({'detail': 'caretaker_id, start_time and slot_time are required'}, status=status.HTTP_400_BAD_REQUEST)

        caretaker = get_object_or_404(Caretaker, pk=caretaker_id)

        # Interpret the provided date string as a day, then apply the slot_time in Europe/Zagreb
        try:
            dt = datetime.fromisoformat(start_time)
        except Exception:
            return Response({'detail': 'Invalid start_time format'}, status=status.HTTP_400_BAD_REQUEST)

        if dt.tzinfo is None:
            # assume UTC if no tz provided
            dt = dt.replace(tzinfo=dt_timezone.utc)

        local_tz = ZoneInfo('Europe/Zagreb')
        local_dt = dt.astimezone(local_tz)

        try:
            hh, mm = [int(p) for p in slot_time.split(':')]
        except Exception:
            return Response({'detail': 'Invalid slot_time format'}, status=status.HTTP_400_BAD_REQUEST)

        requested_local = datetime(local_dt.year, local_dt.month, local_dt.day, hh, mm, tzinfo=local_tz)
        requested_utc = requested_local.astimezone(dt_timezone.utc)
        try:
            req = create_appointment_request(request.user, caretaker, requested_utc, note)
        except Exception as exc:
            # surface validation errors as 400
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        serializer = AppointmentRequestSerializer(req)

        # Ensure times are presented to clients in CET (Europe/Zagreb) ISO with offset
        out = serializer.data
        out['requested_start'] = requested_local.isoformat()
        out['requested_end'] = (requested_local + timedelta(hours=1)).isoformat()

        return Response(out, status=status.HTTP_201_CREATED)


class CaretakerAppointmentRequestListView(generics.ListAPIView):
    """List pending (or filtered) appointment requests for the authenticated caretaker."""
    permission_classes = [IsAuthenticated, IsCaretaker]
    serializer_class = AppointmentRequestSerializer

    def get_queryset(self):
        caretaker = getattr(self.request.user, 'caretaker', None)
        qs = AppointmentRequest.objects.filter(caretaker=caretaker)
        status_q = self.request.query_params.get('status')
        if status_q:
            qs = qs.filter(status=status_q)
        else:
            qs = qs.filter(status=AppointmentRequest.STATUS_PENDING)
        return qs.order_by('-created_at')


class AppointmentRequestApproveView(APIView):
    permission_classes = [IsAuthenticated, IsCaretaker]

    def post(self, request, pk, *args, **kwargs):
        # ensure object exists and belongs to caretaker
        req = get_object_or_404(AppointmentRequest.objects.select_related('caretaker', 'student'), pk=pk)
        # object permission check
        perm = OnlyCaretakerCanApprove()
        if not perm.has_object_permission(request, self, req):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        try:
            appt = approve_appointment_request(request.user, req.id)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AppointmentSerializer(appt)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AppointmentRequestRejectView(APIView):
    permission_classes = [IsAuthenticated, IsCaretaker]

    def post(self, request, pk, *args, **kwargs):
        req = get_object_or_404(AppointmentRequest.objects.select_related('caretaker'), pk=pk)
        perm = OnlyCaretakerCanApprove()
        if not perm.has_object_permission(request, self, req):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        reason = request.data.get('reason')
        req.status = AppointmentRequest.STATUS_REJECTED
        req.save(update_fields=['status'])
        # notify student and caretaker by email (best-effort)
        try:
            from django.core.mail import send_mail
            from django.conf import settings
            recipients = []
            if req.student and getattr(req.student, 'user', None) and req.student.user.email:
                recipients.append(req.student.user.email)
            if getattr(req.caretaker, 'user', None) and req.caretaker.user.email:
                if req.caretaker.user.email not in recipients:
                    recipients.append(req.caretaker.user.email)

            if recipients:
                from zoneinfo import ZoneInfo
                zagreb_tz = ZoneInfo('Europe/Zagreb')
                start_str = req.requested_start.astimezone(zagreb_tz).strftime('%d.%m.%Y u %H:%M')
                subj = 'Zahtjev za razgovor je odbijen - CareFree'
                msg = f"Vaš zahtjev za razgovor {start_str} je odbijen.\n\n"
                msg += "Molimo da u aplikaciji odaberete neki drugi termin."
                send_mail(subject=subj, message=msg, from_email=settings.DEFAULT_FROM_EMAIL, recipient_list=recipients, fail_silently=True)
        except Exception:
            pass

        serializer = AppointmentRequestSerializer(req)
        return Response(serializer.data, status=status.HTTP_200_OK)


class StudentAppointmentListView(generics.ListAPIView):
    """List confirmed (or optionally filtered) appointments for the authenticated student."""
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        student = getattr(self.request.user, 'student', None)
        qs = Appointment.objects.filter(student=student)
        status_q = self.request.query_params.get('status')
        if status_q:
            qs = qs.filter(status=status_q)
        else:
            qs = qs.filter(status__in=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_CONFIRMED_PENDING])
        return qs.order_by('start')


class CaretakerSlotsView(APIView):
    """Return next N days' hour slots for a specified caretaker.

    Query params:
      - caretaker_id (required)
      - days (optional, default 3)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        caretaker_id = request.query_params.get('caretaker_id')
        days = int(request.query_params.get('days') or 3)
        if not caretaker_id:
            return Response({'detail': 'caretaker_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        caretaker = get_object_or_404(Caretaker, pk=caretaker_id)
        slots = get_caretaker_slots(caretaker, days=days)
        serializer = SlotSerializer(slots, many=True)
        return Response(serializer.data)


class ToggleAvailabilityView(APIView):
    """Caretaker can toggle availability for specific hour slots.

    Payload: {"slots": [iso_datetimes], "make_available": true|false}
    """
    permission_classes = [IsAuthenticated, IsCaretaker]

    def post(self, request, *args, **kwargs):
        data = request.data
        slots = data.get('slots')
        make_available = bool(data.get('make_available', True))
        if not slots or not isinstance(slots, (list, tuple)):
            return Response({'detail': 'slots must be a list of ISO datetimes'}, status=status.HTTP_400_BAD_REQUEST)

        result = toggle_availability(request.user, slots, make_available=make_available)
        return Response(result)


class CaretakerAvailabilityBulkSaveView(APIView):
    """Bulk apply availability changes for the authenticated caretaker.

    Payload: {"slots": [{"slot": "ISO_DATETIME", "is_available": true|false}, ...]}
    Returns: {"updated": [...], "failed": [...]} where each updated item contains slot and is_available.
    """
    permission_classes = [IsAuthenticated, IsCaretaker]

    def post(self, request, *args, **kwargs):
        data = request.data
        slots = data.get('slots')
        if not slots or not isinstance(slots, (list, tuple)):
            return Response({'detail': 'slots must be a list of {slot, is_available} objects'}, status=status.HTTP_400_BAD_REQUEST)

        caretaker = getattr(request.user, 'caretaker', None)
        if not caretaker:
            return Response({'detail': 'User is not a caretaker'}, status=status.HTTP_403_FORBIDDEN)

        from django.db import transaction
        from .models import AvailabilitySlot
        from .models import Appointment
        from .tasks import sync_availability_change
        from datetime import timezone as dt_tz

        updated = []
        failed = []

        with transaction.atomic():
            for s in slots:
                slot_iso = s.get('slot')
                want_avail = bool(s.get('is_available'))
                if not slot_iso:
                    failed.append({'slot': slot_iso, 'reason': 'missing_slot'})
                    continue
                try:
                    dt = datetime.fromisoformat(slot_iso)
                except Exception:
                    failed.append({'slot': slot_iso, 'reason': 'invalid_format'})
                    continue

                # assume Europe/Zagreb if no tzinfo present
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=ZoneInfo('Europe/Zagreb'))

                utc_start = dt.astimezone(dt_tz.utc)
                utc_end = utc_start + timedelta(hours=1)

                # do not allow toggling a slot with an existing confirmed appointment
                occupied = Appointment.objects.filter(
                    caretaker=caretaker,
                    start__lt=utc_end,
                    end__gt=utc_start,
                    status__in=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_CONFIRMED_PENDING],
                ).exists()
                if occupied:
                    failed.append({'slot': slot_iso, 'reason': 'occupied'})
                    continue

                obj, created = AvailabilitySlot.objects.update_or_create(
                    caretaker=caretaker,
                    start=utc_start,
                    defaults={'end': utc_end, 'is_available': want_avail},
                )
                updated.append({'slot': slot_iso, 'created': created, 'is_available': obj.is_available})

                # schedule sync for this slot (best-effort)
                try:
                    sync_availability_change.delay(caretaker.pk, utc_start.isoformat(), bool(want_avail))
                except Exception:
                    pass

        return Response({'updated': updated, 'failed': failed})


class CaretakerMyAvailabilityView(APIView):
    """Return all availability slots for the authenticated caretaker (next 7 days).

    Returns slots with is_available flag and also includes confirmed appointments.
    """
    permission_classes = [IsAuthenticated, IsCaretaker]

    def get(self, request, *args, **kwargs):
        caretaker = getattr(request.user, 'caretaker', None)
        if not caretaker:
            return Response({'detail': 'User is not a caretaker'}, status=status.HTTP_403_FORBIDDEN)

        days = int(request.query_params.get('days', 7))
        from datetime import timezone as dt_tz
        from .models import AvailabilitySlot

        now = timezone.now()
        end_date = now + timedelta(days=days)

        # Get all availability slots for this caretaker in the date range
        slots = AvailabilitySlot.objects.filter(
            caretaker=caretaker,
            start__gte=now,
            start__lt=end_date
        ).order_by('start')

        # Get confirmed appointments in the same range
        confirmed_appts = Appointment.objects.filter(
            caretaker=caretaker,
            start__gte=now,
            start__lt=end_date,
            status__in=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_CONFIRMED_PENDING]
        ).values_list('start', flat=True)

        confirmed_starts = set(confirmed_appts)

        # Convert to Europe/Zagreb timezone for response
        local_tz = ZoneInfo('Europe/Zagreb')
        result = []
        for slot in slots:
            local_start = slot.start.astimezone(local_tz)
            local_end = slot.end.astimezone(local_tz)
            result.append({
                'start': local_start.isoformat(),
                'end': local_end.isoformat(),
                'is_available': slot.is_available,
                'has_appointment': slot.start in confirmed_starts,
            })

        return Response(result)


class MyCalendarView(APIView):
    """Return confirmed and completed appointments for the authenticated user (student or caretaker).

    Times are presented in CET (Europe/Zagreb).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        tz_name = 'Europe/Zagreb'
        local_tz = ZoneInfo(tz_name)

        appts = None
        if getattr(request.user, 'student', None):
            appts = Appointment.objects.filter(student=request.user.student, status__in=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_COMPLETED, Appointment.STATUS_CONFIRMED_PENDING])
        elif getattr(request.user, 'caretaker', None):
            appts = Appointment.objects.filter(caretaker=request.user.caretaker, status__in=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_COMPLETED, Appointment.STATUS_CONFIRMED_PENDING])
        else:
            return Response({'detail': 'No calendar for this user'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AppointmentSerializer(appts.order_by('start'), many=True)
        data = serializer.data
        # convert start/end to local tz ISO
        for item in data:
            try:
                # AppointmentSerializer returns timezone-aware strings
                s = datetime.fromisoformat(item.get('start'))
                e = datetime.fromisoformat(item.get('end'))
                if s.tzinfo is None:
                    s = s.replace(tzinfo=dt_timezone.utc)
                if e.tzinfo is None:
                    e = e.replace(tzinfo=dt_timezone.utc)
                item['start'] = s.astimezone(local_tz).isoformat()
                item['end'] = e.astimezone(local_tz).isoformat()
            except Exception:
                pass

        return Response(data)


class CaretakerAppointmentListView(generics.ListAPIView):
    """List confirmed appointments for the authenticated caretaker."""
    permission_classes = [IsAuthenticated, IsCaretaker]
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        caretaker = getattr(self.request.user, 'caretaker', None)
        qs = Appointment.objects.filter(caretaker=caretaker)
        status_q = self.request.query_params.get('status')
        if status_q:
            qs = qs.filter(status=status_q)
        else:
            qs = qs.filter(status__in=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_CONFIRMED_PENDING])
        return qs.order_by('start')
