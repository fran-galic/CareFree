from django.core.management.base import BaseCommand
from calendar_integration.models import GoogleCredential


class Command(BaseCommand):
    help = 'Refresh Google OAuth tokens for all stored GoogleCredential records (best-effort)'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Force refresh regardless of expiry')

    def handle(self, *args, **options):
        force = options.get('force', False)
        creds = GoogleCredential.objects.all()
        total = creds.count()
        updated = 0
        for c in creds:
            ok = c.refresh_if_needed(force=force)
            if ok:
                updated += 1
                self.stdout.write(self.style.SUCCESS(f'Refreshed credential for user {c.user}'))
            else:
                self.stdout.write(self.style.WARNING(f'No refresh for user {c.user}'))
        self.stdout.write(self.style.SUCCESS(f'Done. {updated}/{total} refreshed.'))
