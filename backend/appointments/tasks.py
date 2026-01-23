from celery import shared_task
from django.utils import timezone
from .models import Appointment, CalendarEventLog
from calendar_integration.google_client import create_event, build_service
from django.core.mail import send_mail, EmailMessage
import uuid
import json
from django.conf import settings


@shared_task(bind=True, max_retries=5)
def summarize_appointment_request(self, request_id):
    # stub: call assistant.services.summarize_text and update AppointmentRequest.ai_summary
    try:
        from assistant.services import summarize_text
        from .models import AppointmentRequest
        req = AppointmentRequest.objects.get(pk=request_id)
        summary = summarize_text(req.message or "")
        req.ai_summary = summary.get('summary') if isinstance(summary, dict) else str(summary)
        req.save(update_fields=['ai_summary'])
    except Exception as exc:
        # swallow for now; could retry
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=5)
def sync_create_google_event(self, appointment_id):
    try:
        appt = Appointment.objects.select_related('caretaker', 'student').get(pk=appointment_id)
        payload = {
            'start': appt.start.isoformat(),
            'end': appt.end.isoformat(),
            'summary': 'Sastanak - CareFree',
            'attendees': [appt.caretaker.user.email] + ([appt.student.user.email] if appt.student else []),
            'description': appt.appointment_request.ai_summary or appt.appointment_request.message or '',
        }
        # sanitize attendees: remove falsy values, ensure contains '@', lowercase and dedupe preserving order
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
        # try to use per-user credentials for caretaker if available (create event in their primary calendar)
        calendar_id = getattr(settings, 'GOOGLE_CALENDAR_ID', 'primary')
        user_creds = None
        try:
            from calendar_integration.models import GoogleCredential
            gc = GoogleCredential.objects.filter(user=appt.caretaker.user).first()
            if gc and gc.access_token:
                # build dict acceptable to google.oauth2.credentials.Credentials.from_authorized_user_info
                try:
                    scopes = json.loads(gc.scopes) if gc.scopes else []
                except Exception:
                    scopes = []
                user_creds = {
                    'token': gc.access_token,
                    'refresh_token': gc.refresh_token,
                    'token_uri': gc.token_uri or 'https://oauth2.googleapis.com/token',
                    'client_id': gc.client_id,
                    'client_secret': gc.client_secret,
                    'scopes': scopes,
                    'expiry': gc.expires_at.isoformat() if gc.expires_at else None,
                }
        except Exception:
            user_creds = None

        # prefer creating event directly in caretaker's personal calendar if user_creds present
        try:
            if user_creds:
                # write to the caretaker's primary calendar
                result = create_event(
                    'primary',
                    summary=payload['summary'],
                    description=payload['description'],
                    start=payload['start'],
                    end=payload['end'],
                    attendees=payload['attendees'],
                    create_conference=True,
                    user_credentials=user_creds,
                )
                # preserve calendar id as 'primary' to indicate personal calendar usage
                calendar_id = 'primary'
            else:
                result = create_event(
                    calendar_id,
                    summary=payload['summary'],
                    description=payload['description'],
                    start=payload['start'],
                    end=payload['end'],
                    attendees=payload['attendees'],
                    create_conference=True,
                )
        except Exception:
            # fallback: try service-account calendar
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
        appt.conference_link = result.get('hangoutLink') or (result.get('conferenceData', {}).get('entryPoints') or [{}])[0].get('uri') or result.get('conference_link')
        appt.status = Appointment.STATUS_CONFIRMED
        appt.save(update_fields=['external_event_id', 'conference_link', 'status'])

        CalendarEventLog.objects.create(appointment=appt, operation=CalendarEventLog.OP_CREATE, external_id=appt.external_event_id, request_payload=payload, response_payload=result, status='success', attempts=1, last_attempted_at=timezone.now())

        # Send confirmation email with Meet link after Google Calendar sync
        recipients = []
        if appt.student and getattr(appt.student, 'user', None) and appt.student.user.email:
            recipients.append(appt.student.user.email)
        if getattr(appt.caretaker, 'user', None) and appt.caretaker.user.email:
            if appt.caretaker.user.email not in recipients:
                recipients.append(appt.caretaker.user.email)

        if recipients:
            from zoneinfo import ZoneInfo
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
                    fail_silently=True
                )
            except Exception:
                pass

    except Exception as exc:
        # log and retry
        try:
            appt = Appointment.objects.get(pk=appointment_id)
            CalendarEventLog.objects.create(appointment=appt, operation=CalendarEventLog.OP_CREATE, request_payload={}, response_payload={'error': str(exc)}, status='failed', attempts=1, last_attempted_at=timezone.now())
        except Exception:
            pass
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3)
def sync_cancel_google_event(self, appointment_id):
    try:
        appt = Appointment.objects.get(pk=appointment_id)
        if not appt.external_event_id:
            return
        service = build_service()
        calendar_id = getattr(settings, 'GOOGLE_CALENDAR_ID', 'primary')
        try:
            service.events().delete(calendarId=calendar_id, eventId=appt.external_event_id).execute()
        except Exception:
            # best-effort; continue to clear local references
            pass
        appt.external_event_id = None
        appt.conference_link = None
        appt.save(update_fields=['external_event_id', 'conference_link'])
        CalendarEventLog.objects.create(appointment=appt, operation=CalendarEventLog.OP_DELETE, external_id=None, request_payload={}, response_payload={'status': 'deleted'}, status='success', attempts=1, last_attempted_at=timezone.now())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3)
def sync_availability_change(self, caretaker_id, slot_start_iso, make_available=True):
    """Synchronize a single AvailabilitySlot change with Google Calendar.

    If make_available is False => create a blocking 'Unavailable' event in the configured calendar.
    If make_available is True => remove the previously created event (if any) by looking up
    CalendarEvent with source_type='availability' and source_id='{caretaker_id}:{slot_start_iso}'.
    """
    try:
        from calendar_integration.models import Calendar, CalendarEvent
        from .models import AvailabilitySlot
        from django.conf import settings
        import json
        from datetime import datetime

        # normalize
        src_id = f"{caretaker_id}:{slot_start_iso}"

        cal_id = getattr(settings, 'GOOGLE_CALENDAR_ID', 'primary')

        if not make_available:
            # create event to block time
            ev = create_event(
                cal_id,
                summary='Nedostupan - CareFree',
                description='Caretaker marked this slot as unavailable',
                start=slot_start_iso,
                end=(datetime.fromisoformat(slot_start_iso) + timezone.timedelta(hours=1)).isoformat(),
                attendees=None,
                create_conference=False,
            )

            # persist Calendar and CalendarEvent
            cal_obj, _ = Calendar.objects.get_or_create(calendar_id=cal_id, defaults={'name': cal_id})
            CalendarEvent.objects.update_or_create(
                google_event_id=ev.get('id'),
                defaults={
                    'calendar': cal_obj,
                    'summary': ev.get('summary', ''),
                    'description': ev.get('description', ''),
                    'start': ev.get('start', {}).get('dateTime') or ev.get('start', {}).get('date'),
                    'end': ev.get('end', {}).get('dateTime') or ev.get('end', {}).get('date'),
                    'meet_link': None,
                    'raw': ev,
                    'source_type': 'availability',
                    'source_id': src_id,
                },
            )
        else:
            # make available -> find existing CalendarEvent entries for this slot and delete from Google
            qs = CalendarEvent.objects.filter(source_type='availability', source_id=src_id)
            service = build_service()
            for obj in qs:
                try:
                    service.events().delete(calendarId=obj.calendar.calendar_id if obj.calendar else cal_id, eventId=obj.google_event_id).execute()
                except Exception:
                    pass
                obj.delete()

    except Exception as exc:
        # don't fail hard; retry a few times
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True)
def expire_hold_task(self, hold_id):
    """Expire a ReservationHold when its expiry time is reached."""
    try:
        from .models import ReservationHold
        hold = ReservationHold.objects.get(pk=hold_id)
        # only expire if still active
        if hold.status == ReservationHold.STATUS_ACTIVE:
            hold.mark_expired()
    except ReservationHold.DoesNotExist:
        return
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
