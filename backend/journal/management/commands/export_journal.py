from django.core.management.base import BaseCommand
from journal.models import JournalEntry
from journal.serializers import JournalEntrySerializer
import json

#naredba za izvoz dnevničkih unosa u JSON datoteku
class Command(BaseCommand):
    help = 'Export journal entries (encrypted by default).'

    def add_arguments(self, parser):
        parser.add_argument('--decrypt', action='store_true', help='Attempt to decrypt entries using ENCRYPTION_KEY')
        parser.add_argument('--output', type=str, default='journal_export.json')

    def handle(self, *args, **options):
        decrypt = options['decrypt']
        output = options['output']
        qs = JournalEntry.objects.all().order_by('-created_at')
        serializer = JournalEntrySerializer(qs, many=True)
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(serializer.data, f, ensure_ascii=False, indent=2)
        self.stdout.write(self.style.SUCCESS(f'Exported {qs.count()} entries to {output}'))
