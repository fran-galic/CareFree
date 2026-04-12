import unicodedata

from django.core.cache import cache


CRISIS_SUPPORT_NOTE = (
    "Ako se ponovno budeš osjećao/la ovako preplavljeno ili nesigurno, odmah potraži hitnu stručnu pomoć "
    "ili nazovi krizne brojeve."
)

CRISIS_PATTERNS = (
    "zelim se ubiti",
    "se zelim ubiti",
    "hocu se ubiti",
    "se hocu ubiti",
    "ubit cu se",
    "da se ubijem",
    "samouboj",
    "suicid",
    "ne zelim zivjeti",
    "nema smisla zivjeti",
    "zelim nestati",
    "nauditi sebi",
    "ozlijediti se",
    "ozlijediti sebe",
)


def journal_text_for_safety(*, title: str = "", content: str = "") -> str:
    title = (title or "").strip()
    content = (content or "").strip()
    if title and content:
        return f"Naslov: {title}\n\nZapis: {content}"
    return title or content


def _normalized(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text or "")
    without_diacritics = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return " ".join(without_diacritics.casefold().split())


def looks_like_crisis_content(text: str) -> bool:
    normalized = _normalized(text)
    return any(pattern in normalized for pattern in CRISIS_PATTERNS)


def journal_analysis_allowed(user_id: int, *, limit: int = 6, window_sec: int = 600) -> bool:
    cache_key = f"journal:safety-check:{user_id}"
    current = cache.get(cache_key, 0)
    if current >= limit:
        return False
    cache.set(cache_key, current + 1, timeout=window_sec)
    return True
