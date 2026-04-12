import json
import logging

from pydantic import BaseModel

from assistant.llm import _backup_conversation_model, _backup_conversation_timeout, _get_openai_client
from assistant.privacy import redact_sensitive_text


logger = logging.getLogger(__name__)


class JournalSafetyResult(BaseModel):
    crisis_detected: bool = False
    reason: str = ""


def classify_journal_safety(text: str) -> JournalSafetyResult:
    redacted_text = redact_sensitive_text(text or "").strip()
    if not redacted_text:
        return JournalSafetyResult()

    client = _get_openai_client()
    prompt = (
        "Procijeni sadrži li dnevnički zapis znakove mogućeg neposrednog kriznog stanja, suicidalne namjere, "
        "samoozljeđivanja ili ozbiljne opasnosti za osobu. Vrati isključivo JSON objekt sa poljima "
        '`crisis_detected` (boolean) i `reason` (kratak sažetak na hrvatskom, max 20 riječi). '
        "Označi true samo ako postoje ozbiljni signali kriznog rizika. Ne dijagnosticiraj i ne dodaj savjete.\n\n"
        f"Dnevnički zapis:\n{redacted_text}"
    )

    completion = client.chat.completions.create(
        model=_backup_conversation_model(),
        messages=[
            {"role": "system", "content": "Ti si sigurnosni klasifikator za studentski dnevnik."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        timeout=max(3.0, min(8.0, _backup_conversation_timeout())),
    )
    payload = json.loads((completion.choices[0].message.content or "{}").strip())
    result = JournalSafetyResult.model_validate(payload)
    logger.warning(
        "journal_safety_classified crisis_detected=%s reason=%s",
        result.crisis_detected,
        result.reason,
    )
    return result
