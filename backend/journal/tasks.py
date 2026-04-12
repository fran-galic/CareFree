import logging

from celery import shared_task

from .ai import classify_journal_safety
from .models import JournalEntry
from .safety import CRISIS_SUPPORT_NOTE


logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2)
def analyze_journal_entry_safety(self, entry_id: int):
    try:
        entry = JournalEntry.objects.get(pk=entry_id)
    except JournalEntry.DoesNotExist:
        return

    content = entry.content or ""
    if not content or entry.crisis_detected:
        return

    try:
        result = classify_journal_safety(content)
    except Exception as exc:
        logger.warning("journal_ai_safety_task_failed entry_id=%s error=%s", entry_id, exc)
        raise self.retry(exc=exc, countdown=30 * (self.request.retries + 1))

    entry.crisis_detected = bool(result.crisis_detected)
    entry.analysis_summary = CRISIS_SUPPORT_NOTE if result.crisis_detected else None
    entry.save(update_fields=["crisis_detected", "analysis_summary", "updated_at"])
