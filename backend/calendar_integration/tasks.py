from celery import shared_task
from django.utils import timezone
from django.conf import settings
from .google_client import list_events
from .models import Calendar, CalendarEvent, ReconcileLog
import datetime
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def reconcile_google_calendar(self, calendar_id: str | None = None, days: int = 30, dry_run: bool = True):
    """Reconcile Google Calendar with local CalendarEvent rows.

    - By default operates on the configured global `GOOGLE_CALENDAR_ID` unless `calendar_id` provided.
    - `days` is the forward window to compare.
    - `dry_run=True` will only log and create ReconcileLog entries; it will not modify local CalendarEvent/Appointment objects.
    """
    cal_id = calendar_id or getattr(settings, 'GOOGLE_CALENDAR_ID', 'primary')
    now = timezone.now()
    time_min = now.isoformat()
    time_max = (now + datetime.timedelta(days=days)).isoformat()

    # ensure Calendar obj exists locally
    cal_obj, _ = Calendar.objects.get_or_create(calendar_id=cal_id, defaults={'name': cal_id})

    try:
        events = list_events(cal_id, time_min, time_max)
    except Exception as exc:
        logger.exception('Failed to list events for calendar %s: %s', cal_id, exc)
        raise

    google_ids = {ev.get('id') for ev in events if ev.get('id')}
    local_ids = set(CalendarEvent.objects.filter(calendar__calendar_id=cal_id).values_list('google_event_id', flat=True))

    # events present in Google but missing locally
    missing_locally = google_ids - set([i for i in local_ids if i])
    for gid in missing_locally:
        ev = next((e for e in events if e.get('id') == gid), None)
        details = {'summary': ev.get('summary'), 'start': ev.get('start'), 'end': ev.get('end')} if ev else {}
        ReconcileLog.objects.create(calendar=cal_obj, google_event_id=gid, status='missing_locally', details=details)
        logger.info('Reconcile: missing locally %s', gid)

    # events present locally but missing in Google
    missing_in_google = set([i for i in local_ids if i]) - google_ids
    for gid in missing_in_google:
        ReconcileLog.objects.create(calendar=cal_obj, google_event_id=gid, status='missing_in_google', details={})
        logger.info('Reconcile: missing in google %s', gid)

    # check for changed events (simple checksum on summary/start/end)
    local_map = {ce.google_event_id: ce for ce in CalendarEvent.objects.filter(calendar__calendar_id=cal_id)}
    for ev in events:
        gid = ev.get('id')
        if not gid or gid not in local_map:
            continue
        local = local_map.get(gid)
        g_summary = ev.get('summary')
        g_start = ev.get('start', {}).get('dateTime') or ev.get('start', {}).get('date')
        g_end = ev.get('end', {}).get('dateTime') or ev.get('end', {}).get('date')
        changed = False
        details = {}
        if (local.summary or '') != (g_summary or ''):
            changed = True
            details['summary_local'] = local.summary
            details['summary_google'] = g_summary
        local_start = local.start.isoformat() if getattr(local, 'start', None) else None
        if local_start != g_start:
            changed = True
            details['start_local'] = local_start
            details['start_google'] = g_start
        local_end = local.end.isoformat() if getattr(local, 'end', None) else None
        if local_end != g_end:
            changed = True
            details['end_local'] = local_end
            details['end_google'] = g_end
        if changed:
            ReconcileLog.objects.create(calendar=cal_obj, google_event_id=gid, status='changed', details=details)
            logger.info('Reconcile: changed %s -> %s', gid, details)

    return {'missing_locally': len(missing_locally), 'missing_in_google': len(missing_in_google)}
"""Celery tasks for calendar integration.

Provides a simple task wrapper that triggers the management command
to sync the Google Calendar into the local database.
"""

from django.core.management import call_command

from celery import shared_task


#Celery task za sinkronizaciju Google kalendara
@shared_task(bind=True, max_retries=3)
def sync_google_calendar_task(self) -> None:
    """Run the management command to sync Google Calendar.

    Uses Celery retries on failure.
    """
    try:
        #pokreće se Google Calendar sync putem management command-a
        call_command("sync_google_calendar")
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60) from exc
