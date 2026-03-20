from django.db import transaction
from django.core.exceptions import PermissionDenied
from django.utils import timezone
from datetime import timedelta
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo
from datetime import datetime
from django.conf import settings

from .models import AppointmentRequest, Appointment
from .tasks import summarize_appointment_request, sync_create_google_event
from .tasks import expire_hold_task
from .models import ReservationHold
from django.utils import timezone as dj_timezone
from backend.emailing import render_branded_email, send_project_email
from .google_sync import (
    build_appointment_payload,
    extract_conference_link,
    get_shared_calendar_id,
)


ACTIVE_APPOINTMENT_STATUSES = (
    Appointment.STATUS_CONFIRMED,
    Appointment.STATUS_CONFIRMED_PENDING,
    Appointment.STATUS_SYNC_FAILED,
)


def _send_appointment_confirmation_email(appt):
    recipients = []
    if appt.student and getattr(appt.student, 'user', None) and appt.student.user.email:
        recipients.append(appt.student.user.email)
    if getattr(appt.caretaker, 'user', None) and appt.caretaker.user.email:
        if appt.caretaker.user.email not in recipients:
            recipients.append(appt.caretaker.user.email)

    if not recipients:
        return

    zagreb_tz = ZoneInfo('Europe/Zagreb')
    start_str = appt.start.astimezone(zagreb_tz).strftime('%d.%m.%Y u %H:%M')
    body = f"Vaš zahtjev za razgovor {start_str} je potvrđen!\n\n"
    if appt.conference_link:
        body += f"Sastanku možete pristupiti putem ovog linka: {appt.conference_link}"
    else:
        body += "Termin je potvrđen, ali Meet link trenutno nije generiran."

    action_url = appt.conference_link or f"{settings.FRONTEND_URL.rstrip('/')}/carefree/calendar?appointment={appt.id}"
    html_message, plain_message = render_branded_email(
        title="Termin je potvrđen",
        intro=f"Vaš razgovor za termin {start_str} je potvrđen.",
        body_lines=[
            "Detalje termina možete otvoriti i unutar CareFree kalendara.",
            "Google Meet link je uključen čim bude dostupan.",
        ] if not appt.conference_link else [
            "Termin je upisan u kalendar i spreman za pristup.",
            f"Google Meet link: {appt.conference_link}",
        ],
        action_label="Otvori termin",
        action_url=action_url,
        recipient_name=(getattr(appt.student.user, "first_name", "") if appt.student else "") or getattr(appt.caretaker.user, "first_name", "") or None,
    )

    try:
        send_project_email(
            subject='Potvrda termina - CareFree',
            message=plain_message or body,
            recipient_list=recipients,
            html_message=html_message,
            fail_silently=True,
        )
    except Exception:
        pass


def create_appointment_request(student_user, caretaker_obj, requested_start, message):
    # student_user may be None (anonymous) per model
    # Validate slot: not explicitly marked unavailable and not already occupied
    from django.core.exceptions import ValidationError
    from .models import AvailabilitySlot

    requested_end = requested_start + timedelta(hours=1)

    # Use a transaction and row-level locks to avoid races with holds and other concurrent bookings.
    with transaction.atomic():
        # check explicit unavailability
        unavailable = AvailabilitySlot.objects.filter(caretaker=caretaker_obj, start=requested_start, is_available=False).exists()
        if unavailable:
            raise ValidationError("Requested slot is marked unavailable by the caretaker")

        # lock overlapping appointments (if any) to prevent double-booking races
        overlapping = Appointment.objects.select_for_update().filter(
            caretaker=caretaker_obj,
            start__lt=requested_end,
            end__gt=requested_start,
            status__in=ACTIVE_APPOINTMENT_STATUSES,
        )
        if overlapping.exists():
            raise ValidationError("Requested slot is already taken")

        # check for active holds on this slot
        from .models import ReservationHold
        active_holds = ReservationHold.objects.select_for_update().filter(
            caretaker=caretaker_obj,
            start=requested_start,
            status=ReservationHold.STATUS_ACTIVE,
        )
        if active_holds.exists():
            hold = active_holds.first()
            # if the hold belongs to the same student, consume it atomically and proceed
            if getattr(student_user, 'student', None) and hold.student == getattr(student_user, 'student', None):
                hold.consume()
            else:
                # another user holds this slot
                raise ValidationError('Requested slot is currently held by another user')

        # all checks passed; create the AppointmentRequest
        req = AppointmentRequest.objects.create(
            student=getattr(student_user, 'student', None),
            caretaker=caretaker_obj,
            requested_start=requested_start,
            requested_end=requested_end,
            message=message,
        )

    # Send notification email to caretaker about new appointment request
    try:
        if getattr(caretaker_obj, 'user', None) and caretaker_obj.user.email:
            zagreb_tz = ZoneInfo('Europe/Zagreb')
            start_str = requested_start.astimezone(zagreb_tz).strftime('%d.%m.%Y u %H:%M')
            student_name = "Student"
            if req.student and getattr(req.student, 'user', None):
                student_name = req.student.user.get_full_name() or req.student.user.username
            
            body = f"Dobili ste novi zahtjev za termin!\n\n"
            body += f"Student: {student_name}\n"
            body += f"Vrijeme: {start_str}\n"
            body += f"Poruka: {message or '(bez poruke)'}\n\n"
            body += f"Molimo prijavite se u CareFree aplikaciju za potvrdu/odbijanje zahtjeva."
            html_message, plain_message = render_branded_email(
                title='Novi zahtjev za termin',
                intro='Zaprimili ste novi zahtjev za razgovor u CareFree aplikaciji.',
                body_lines=[
                    f'Student: {student_name}',
                    f'Vrijeme: {start_str}',
                    f'Poruka: {message or "(bez poruke)"}',
                ],
                action_label='Otvori zahtjeve',
                action_url=f"{settings.FRONTEND_URL.rstrip('/')}/carefree/requests",
                recipient_name=getattr(caretaker_obj.user, 'first_name', '') or caretaker_obj.user.email,
            )
            
            send_project_email(
                subject='Novi zahtjev za termin - CareFree',
                message=plain_message or body,
                recipient_list=[caretaker_obj.user.email],
                html_message=html_message,
                fail_silently=True
            )
    except Exception:
        pass

    # enqueue summarization task (best-effort) outside the transaction
    try:
        summarize_appointment_request.delay(req.id)
    except Exception:
        pass

    return req


def create_hold(student_user, caretaker_obj, slot_start, hold_minutes=10):
    """Create a temporary hold for `hold_minutes` minutes on the given slot_start (UTC).

    Raises ValidationError if slot is unavailable or already taken/held.
    Returns the created ReservationHold instance.
    """
    from django.core.exceptions import ValidationError

    slot_end = slot_start + timedelta(hours=1)

    # check explicit unavailability
    from .models import AvailabilitySlot
    if AvailabilitySlot.objects.filter(caretaker=caretaker_obj, start=slot_start, is_available=False).exists():
        raise ValidationError('Slot marked unavailable by caretaker')

    # check confirmed appointments
    if Appointment.objects.filter(
        caretaker=caretaker_obj,
        start__lt=slot_end,
        end__gt=slot_start,
        status__in=ACTIVE_APPOINTMENT_STATUSES,
    ).exists():
        raise ValidationError('Slot already taken')

    # check active holds
    if ReservationHold.objects.filter(caretaker=caretaker_obj, start=slot_start, status=ReservationHold.STATUS_ACTIVE).exists():
        raise ValidationError('Slot already held by another user')

    hold = ReservationHold.objects.create(
        student=getattr(student_user, 'student', None),
        caretaker=caretaker_obj,
        start=slot_start,
        end=slot_end,
        expires_at=dj_timezone.now() + timedelta(minutes=hold_minutes),
    )

    # schedule expiry task
    try:
        # schedule task to run at expiry
        expire_hold_task.apply_async((hold.id,), eta=hold.expires_at)
    except Exception:
        # best-effort; if scheduling fails, rely on periodic reconciliation
        pass

    return hold


def release_hold(hold_obj):
    """Manually release a hold (mark expired)."""
    hold_obj.mark_expired()
    return hold_obj


def approve_appointment_request(approver_user, request_id):
    req = AppointmentRequest.objects.select_related('caretaker', 'student').get(pk=request_id)
    # authorization
    if not getattr(approver_user, 'caretaker', None) or approver_user.caretaker != req.caretaker:
        raise PermissionDenied("Not authorized to approve this request")

    with transaction.atomic():
        # ensure caretaker hasn't marked this slot unavailable
        from .models import AvailabilitySlot
        unavailable = AvailabilitySlot.objects.filter(
            caretaker=req.caretaker,
            start=req.requested_start,
            is_available=False,
        ).exists()
        if unavailable:
            raise Exception("Slot marked unavailable by caretaker")
        overlapping = Appointment.objects.select_for_update().filter(
            caretaker=req.caretaker,
            start__lt=req.requested_end,
            end__gt=req.requested_start,
            status__in=ACTIVE_APPOINTMENT_STATUSES,
        )
        if overlapping.exists():
            raise Exception("Slot already taken")

        appt = Appointment.objects.create(
            appointment_request=req,
            caretaker=req.caretaker,
            student=req.student,
            start=req.requested_start,
            end=req.requested_end,
            status=Appointment.STATUS_CONFIRMED_PENDING,
        )
        req.status = AppointmentRequest.STATUS_ACCEPTED
        req.save(update_fields=['status'])

    # Create Google Calendar event in the system calendar and send a single confirmation email.
    try:
        sync_create_google_event_sync(appt.id)
    except Exception as sync_exc:
        # Send fallback email without Meet link
        try:
            appt.status = Appointment.STATUS_SYNC_FAILED
            appt.save(update_fields=['status'])
            _send_appointment_confirmation_email(appt)
        except Exception:
            pass

    return appt


def sync_create_google_event_sync(appointment_id):
    """Synchronous version of sync_create_google_event for when Celery is not available"""
    from .models import Appointment, CalendarEventLog
    from calendar_integration.google_client import create_event
    
    try:
        appt = Appointment.objects.select_related('caretaker', 'student').get(pk=appointment_id)
        calendar_id = get_shared_calendar_id()
        payload = build_appointment_payload(appt)
        
        result = create_event(
            calendar_id,
            summary=payload['summary'],
            description=payload['description'],
            start=payload['start'],
            end=payload['end'],
            attendees=payload['attendees'],
            create_conference=True,
        )
        
        appt.external_event_id = result.get('id')
        appt.calendar_id = calendar_id
        appt.conference_link = extract_conference_link(result)
        appt.status = Appointment.STATUS_CONFIRMED
        appt.save(update_fields=['external_event_id', 'calendar_id', 'conference_link', 'status'])
        CalendarEventLog.objects.create(
            appointment=appt,
            operation=CalendarEventLog.OP_CREATE,
            external_id=appt.external_event_id,
            request_payload=payload,
            response_payload=result,
            status='success',
            attempts=1,
            last_attempted_at=dj_timezone.now(),
        )
        _send_appointment_confirmation_email(appt)
    except Exception:
        raise


def get_caretaker_slots(caretaker_obj, days=3, start_hour=8, end_hour=18, tz_name="Europe/Zagreb"):
    """Return a list of hour-long slots for the next `days` days between start_hour and end_hour.

    Each slot is a dict: {start, end, time, is_available} where start/end/time are ISO strings
    expressed in the configured local timezone (tz_name). Availability is computed by combining
    explicit AvailabilitySlot overrides and existing confirmed Appointments.
    """
    from .models import AvailabilitySlot

    slots = []
    local_tz = ZoneInfo(tz_name)
    now_local = datetime.now(tz=local_tz)

    for d in range(days):
        day = (now_local.date()) + timedelta(days=d)
        for hh in range(start_hour, end_hour):
            local_start = datetime(day.year, day.month, day.day, hh, 0, tzinfo=local_tz)
            local_end = local_start + timedelta(hours=1)
            # convert to UTC for DB comparison
            utc_start = local_start.astimezone(dt_timezone.utc)
            utc_end = local_end.astimezone(dt_timezone.utc)

            # check for overlapping confirmed appointments
            occupied = Appointment.objects.filter(
                caretaker=caretaker_obj,
                start__lt=utc_end,
                end__gt=utc_start,
                status__in=ACTIVE_APPOINTMENT_STATUSES,
            ).exists()

            # check for explicit override
            try:
                slot_obj = AvailabilitySlot.objects.get(caretaker=caretaker_obj, start=utc_start)
                is_avail = bool(slot_obj.is_available)
            except AvailabilitySlot.DoesNotExist:
                # If caretaker hasn't set this slot, it's NOT available by default
                is_avail = False

            if occupied:
                is_avail = False
            slots.append({
                "start": local_start.isoformat(),
                "end": local_end.isoformat(),
                "time": local_start.time().strftime("%H:%M"),
                "is_available": is_avail,
            })

    return slots


def toggle_availability(caretaker_user, slot_starts, tz_name="Europe/Zagreb", make_available=False):
    """Toggle availability for the authenticated caretaker.

    `slot_starts` should be an iterable of ISO datetime strings (preferably with tzinfo).
    Returns a dict with 'updated' list and 'failed' list of slot starts that could not be changed
    (e.g., because a confirmed appointment exists).
    """
    from .models import AvailabilitySlot

    caretaker = getattr(caretaker_user, "caretaker", None)
    if not caretaker:
        raise PermissionDenied("User is not a caretaker")

    local_tz = ZoneInfo(tz_name)
    updated = []
    failed = []

    for s in slot_starts:
        try:
            dt = datetime.fromisoformat(s)
        except Exception:
            failed.append({"slot": s, "reason": "invalid_format"})
            continue

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=local_tz)

        utc_start = dt.astimezone(dt_timezone.utc)
        utc_end = utc_start + timedelta(hours=1)

        # don't allow toggling a slot that already has a confirmed appointment
        occupied = Appointment.objects.filter(
            caretaker=caretaker,
            start__lt=utc_end,
            end__gt=utc_start,
            status__in=ACTIVE_APPOINTMENT_STATUSES,
        ).exists()

        if occupied:
            failed.append({"slot": s, "reason": "occupied"})
            continue

        obj, created = AvailabilitySlot.objects.update_or_create(
            caretaker=caretaker,
            start=utc_start,
            defaults={"end": utc_end, "is_available": bool(make_available)},
        )
        updated.append({"slot": s, "created": created, "is_available": obj.is_available})

        # enqueue Google Calendar sync (best-effort)
        try:
            from .tasks import sync_availability_change
            # pass ISO in UTC for deterministic source id
            sync_availability_change.delay(caretaker.pk, utc_start.isoformat(), bool(make_available))
        except Exception:
            # ignore failures to enqueue
            pass

    return {"updated": updated, "failed": failed}
