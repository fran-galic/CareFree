from django.db import transaction
from django.core.exceptions import PermissionDenied
from django.utils import timezone
from datetime import timedelta
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo
from datetime import datetime

from .models import AppointmentRequest, Appointment
from .tasks import summarize_appointment_request, sync_create_google_event
from .tasks import expire_hold_task
from .models import ReservationHold
from django.utils import timezone as dj_timezone


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
            status__in=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_CONFIRMED_PENDING],
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
        from django.core.mail import send_mail
        from django.conf import settings
        
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
            
            send_mail(
                subject='Novi zahtjev za termin - CareFree',
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[caretaker_obj.user.email],
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
    if Appointment.objects.filter(caretaker=caretaker_obj, start__lt=slot_end, end__gt=slot_start, status__in=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_CONFIRMED_PENDING]).exists():
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
            status__in=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_CONFIRMED_PENDING]
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

    # Create Google Calendar event and send single email with Meet link
    try:
        sync_create_google_event_sync(appt.id)
    except Exception as sync_exc:
        # Send fallback email without Meet link
        try:
            from django.core.mail import send_mail
            from django.conf import settings
            
            if req.student and getattr(req.student, 'user', None) and req.student.user.email:
                zagreb_tz = ZoneInfo('Europe/Zagreb')
                start_str = req.requested_start.astimezone(zagreb_tz).strftime('%d.%m.%Y u %H:%M')
                caretaker_name = req.caretaker.user.get_full_name() or "Caretaker"
                
                body = f"Vaš zahtjev za termin je prihvaćen!\n\n"
                body += f"Caretaker: {caretaker_name}\n"
                body += f"Vrijeme: {start_str}\n\n"
                body += f"Kontaktirajte caretaker-a za detalje sastanka.\n\n"
                body += f"Vidimo se!"
                
                send_mail(
                    subject='Zahtjev za termin prihvaćen - CareFree',
                    message=body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[req.student.user.email],
                    fail_silently=True
                )
        except Exception:
            pass

    return appt


def sync_create_google_event_sync(appointment_id):
    """Synchronous version of sync_create_google_event for when Celery is not available"""
    from django.core.mail import send_mail
    from django.conf import settings
    from .models import Appointment, CalendarEventLog
    from calendar_integration.google_client import create_event
    from django.utils import timezone
    
    try:
        appt = Appointment.objects.select_related('caretaker', 'student').get(pk=appointment_id)
        payload = {
            'start': appt.start.isoformat(),
            'end': appt.end.isoformat(),
            'summary': 'Sastanak - CareFree',
            'attendees': [appt.caretaker.user.email] + ([appt.student.user.email] if appt.student else []),
            'description': appt.appointment_request.ai_summary or appt.appointment_request.message or '',
        }
        
        # sanitize attendees
        raw_att = payload.get('attendees') or []
        cleaned = []
        seen = set()
        for a in raw_att:
            try:
                email = (a or '').strip()
            except Exception:
                continue
            if not email or '@' not in email:
                continue
            email = email.lower()
            if email in seen:
                continue
            seen.add(email)
            cleaned.append(email)
        payload['attendees'] = cleaned
        
        # Get caretaker's Google OAuth credentials
        from calendar_integration.models import GoogleCredential
        caretaker_user = appt.caretaker.user
        user_creds = None
        
        try:
            google_cred = GoogleCredential.objects.get(user=caretaker_user)
            if google_cred.access_token and google_cred.refresh_token:
                # Parse scopes from JSON string
                import json
                try:
                    scopes = json.loads(google_cred.scopes) if google_cred.scopes else ['https://www.googleapis.com/auth/calendar']
                except (json.JSONDecodeError, TypeError):
                    scopes = ['https://www.googleapis.com/auth/calendar']
                
                user_creds = {
                    'token': google_cred.access_token,
                    'refresh_token': google_cred.refresh_token,
                    'token_uri': google_cred.token_uri or 'https://oauth2.googleapis.com/token',
                    'client_id': google_cred.client_id or settings.GOOGLE_OAUTH_CLIENT_ID,
                    'client_secret': google_cred.client_secret or settings.GOOGLE_OAUTH_CLIENT_SECRET,
                    'scopes': scopes,
                }
        except GoogleCredential.DoesNotExist:
            raise Exception(f"Caretaker {caretaker_user.email} has not connected their Google Calendar")
        
        # Create Google Calendar event using caretaker's credentials
        result = create_event(
            'primary',  # Use caretaker's primary calendar
            summary=payload['summary'],
            description=payload['description'],
            start=payload['start'],
            end=payload['end'],
            attendees=payload['attendees'],
            create_conference=True,
            user_credentials=user_creds,
        )
        
        appt.external_event_id = result.get('id')
        appt.conference_link = result.get('hangoutLink') or (result.get('conferenceData', {}).get('entryPoints') or [{}])[0].get('uri') or result.get('conference_link')
        appt.status = Appointment.STATUS_CONFIRMED
        appt.save(update_fields=['external_event_id', 'conference_link', 'status'])
        
        # Send email with Meet link
        recipients = []
        if appt.student and getattr(appt.student, 'user', None) and appt.student.user.email:
            recipients.append(appt.student.user.email)
        if getattr(appt.caretaker, 'user', None) and appt.caretaker.user.email:
            if appt.caretaker.user.email not in recipients:
                recipients.append(appt.caretaker.user.email)
        
        if recipients:
            zagreb_tz = ZoneInfo('Europe/Zagreb')
            start_str = appt.start.astimezone(zagreb_tz).strftime('%d.%m.%Y u %H:%M')
            body = f"Vaš zahtjev za razgovor {start_str} je potvrđen!\n\n"
            if appt.conference_link:
                body += f"Sastanku možete pristupiti putem ovog linka: {appt.conference_link}"
            else:
                body += "Detalji sastanka bit će poslani uskoro."
            
            try:
                send_mail(
                    subject='Potvrda termina - CareFree',
                    message=body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=recipients,
                    fail_silently=False
                )
            except Exception as email_error:
                pass
    except Exception as e:
        raise


def get_caretaker_slots(caretaker_obj, days=3, start_hour=8, end_hour=16, tz_name="Europe/Zagreb"):
    """Return a list of hour-long slots for the next `days` days between start_hour and end_hour.

    Each slot is a dict: {start, end, time, is_available} where start/end/time are ISO strings
    expressed in the configured local timezone (tz_name). Availability is computed by combining
    explicit AvailabilitySlot overrides and existing confirmed Appointments.
    """
    from .models import AvailabilitySlot

    slots = []
    local_tz = ZoneInfo(tz_name)
    now_local = datetime.now(tz=local_tz)

    # prepare optional freebusy busy intervals (UTC)
    busy_intervals = []
    try:
        # attempt to use per-user GoogleCredential if available
        cred = getattr(getattr(caretaker_obj, 'user', None), 'google_credential', None)
        if cred and getattr(cred, 'access_token', None):
            from calendar_integration.google_client import freebusy_query

            # compute UTC range covering all requested days/hours
            first_local_start = datetime(now_local.year, now_local.month, now_local.day, start_hour, tzinfo=local_tz)
            last_day = (now_local.date()) + timedelta(days=days - 1)
            last_local_end = datetime(last_day.year, last_day.month, last_day.day, end_hour, tzinfo=local_tz)
            utc_range_start = first_local_start.astimezone(dt_timezone.utc).isoformat()
            utc_range_end = last_local_end.astimezone(dt_timezone.utc).isoformat()

            user_creds = {
                'token': cred.access_token,
                'refresh_token': cred.refresh_token,
                'token_uri': cred.token_uri,
                'client_id': cred.client_id,
                'client_secret': cred.client_secret,
                'scopes': cred.scopes.split(',') if cred.scopes else [],
            }

            res = freebusy_query(utc_range_start, utc_range_end, items=[{'id': 'primary'}], user_credentials=user_creds)
            cal = res.get('calendars', {}).get('primary', {})
            busy = cal.get('busy', [])
            for b in busy:
                try:
                    bs = datetime.fromisoformat(b['start']).astimezone(dt_timezone.utc)
                    be = datetime.fromisoformat(b['end']).astimezone(dt_timezone.utc)
                    busy_intervals.append((bs, be))
                except Exception:
                    continue
    except Exception:
        # best-effort: if freebusy check fails, quietly ignore and proceed with local info only
        busy_intervals = []

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
                status__in=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_CONFIRMED_PENDING],
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
            
            # if Google reports busy for this time, mark unavailable
            if is_avail and busy_intervals:
                for (bs, be) in busy_intervals:
                    if (utc_start < be) and (utc_end > bs):
                        is_avail = False
                        break
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
            status__in=[Appointment.STATUS_CONFIRMED, Appointment.STATUS_CONFIRMED_PENDING],
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
