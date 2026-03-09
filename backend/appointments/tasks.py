from celery import shared_task
from django.utils import timezone
from .models import Appointment, CalendarEventLog
from calendar_integration.google_client import create_event, build_service
from backend.emailing import send_project_email
from .google_sync import (
    build_appointment_payload,
    extract_conference_link,
    get_shared_calendar_id,
)


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
                send_project_email(
                    subject='Potvrda termina - CareFree',
                    message=body,
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
        calendar_id = appt.calendar_id or get_shared_calendar_id(required=False)
        if not calendar_id:
            return
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
        from datetime import datetime

        # normalize
        src_id = f"{caretaker_id}:{slot_start_iso}"

        cal_id = get_shared_calendar_id(required=False)
        if not cal_id:
            return

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
