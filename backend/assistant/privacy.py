import re


EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:(?:\+|00)\d{1,3}[\s/-]?)?(?:\d[\s/-]?){8,14}\d")
URL_RE = re.compile(r"\b(?:https?://|www\.)\S+\b", re.IGNORECASE)
OIB_RE = re.compile(r"\b\d{11}\b")
JMBAG_RE = re.compile(r"\b\d{10}\b")
ADDRESS_RE = re.compile(
    r"\b(?:ul\.?|ulica|trg|avenija|av\.?|cesta|put|obala)\s+[A-Za-zČĆŠĐŽčćšđž0-9 .'-]{3,}\d+[A-Za-z]?\b",
    re.IGNORECASE,
)


def redact_sensitive_text(text: str) -> str:
    cleaned = text or ""
    replacements = (
        (EMAIL_RE, "[email_adresa]"),
        (JMBAG_RE, "[jmbag]"),
        (OIB_RE, "[oib]"),
        (PHONE_RE, "[telefon]"),
        (URL_RE, "[poveznica]"),
        (ADDRESS_RE, "[adresa]"),
    )
    for pattern, token in replacements:
        cleaned = pattern.sub(token, cleaned)
    return cleaned


def redact_message_payload(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    redacted: list[dict[str, str]] = []
    for message in messages:
        next_message = dict(message)
        if next_message.get("role") == "user" and "content" in next_message:
            next_message["content"] = redact_sensitive_text(next_message["content"])
        redacted.append(next_message)
    return redacted
