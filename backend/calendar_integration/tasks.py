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
