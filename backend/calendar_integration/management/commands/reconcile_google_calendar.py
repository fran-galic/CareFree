from django.core.management.base import BaseCommand
from calendar_integration.tasks import reconcile_google_calendar


class Command(BaseCommand):
    help = 'Run Google calendar reconciler (calls Celery task synchronously)'

    def add_arguments(self, parser):
        parser.add_argument('--calendar-id', type=str, help='Calendar ID to reconcile')
        parser.add_argument('--days', type=int, default=30, help='Days forward to reconcile')
        parser.add_argument('--dry-run', action='store_true', default=False, help='If set, run in dry-run mode')

    def handle(self, *args, **options):
        cal = options.get('calendar_id')
        days = options.get('days')
        dry_run = options.get('dry_run')
        # call Celery task synchronously
        result = reconcile_google_calendar.run(calendar_id=cal, days=days, dry_run=dry_run)
        self.stdout.write(str(result))
