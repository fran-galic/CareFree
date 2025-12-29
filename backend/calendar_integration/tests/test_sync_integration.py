from django.core.management import call_command
from django.test import TestCase

#Test case za integracijsko testiranje sync_google_calendar management command-a
class SyncCommandIntegrationTest(TestCase):
    def test_sync_command_runs_without_error(self) -> None:
        call_command("sync_google_calendar")

