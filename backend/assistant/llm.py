import json
import logging
import unicodedata
from time import perf_counter

from django.conf import settings
from openai import APITimeoutError, OpenAI, RateLimitError

from accounts.models import HelpCategory

from .category_codes import resolve_category_selection
from .prompts import build_system_prompt
from .schemas import AssistantLLMResult

logger = logging.getLogger(__name__)


def _get_openai_client() -> OpenAI:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def _conversation_model() -> str:
    return getattr(settings, "AI_CONVERSATION_MODEL", "gpt-5.2-chat-latest")


def _conversation_timeout() -> float:
    return float(getattr(settings, "AI_CONVERSATION_TIMEOUT_SEC", 7))


def _backup_conversation_model() -> str:
    return getattr(settings, "AI_BACKUP_CONVERSATION_MODEL", "gpt-4o-mini")


def _backup_conversation_timeout() -> float:
    return float(getattr(settings, "AI_BACKUP_CONVERSATION_TIMEOUT_SEC", 8))


def _max_recent_messages() -> int:
    return int(getattr(settings, "AI_MAX_RECENT_CHAT_MESSAGES", 8))


def _max_previous_summaries() -> int:
    return int(getattr(settings, "AI_MAX_PREVIOUS_SUMMARIES", 2))


def _max_attempts() -> int:
    return int(getattr(settings, "AI_CONVERSATION_MAX_ATTEMPTS", 1))


def _contains_any(text: str, phrases: tuple[str, ...]) -> bool:
    return any(phrase in text for phrase in phrases)


def _normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text or "")
    without_diacritics = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return " ".join(without_diacritics.casefold().split())


def _looks_like_greeting(text: str) -> bool:
    compact = text.replace(" ", "")
    greetings = (
        "bok",
        "book",
        "bokk",
        "bog",
        "hej",
        "hejj",
        "ej",
        "eej",
        "hello",
        "pozdrav",
    )
    return any(compact == item or compact.startswith(item) for item in greetings)


def _short_user_excerpt(text: str, max_words: int = 10) -> str:
    words = [word for word in (text or "").strip().split() if word]
    if not words:
        return ""
    excerpt = " ".join(words[:max_words]).strip(" .,!?")
    return excerpt


def _context_focus_phrase(normalized_text: str, raw_text: str) -> str:
    if _contains_any(normalized_text, ("deda", "dedom", "baka", "mam", "tata", "roditelj", "brat", "sestra")):
        if "deda" in normalized_text or "dedom" in normalized_text:
            return "to što se događa s djedom"
        if "baka" in normalized_text:
            return "to što se događa s bakom"
        return "to što se događa u obitelji"
    if _contains_any(normalized_text, ("faks", "fakultet", "ispit", "ispiti", "rok", "rokovi", "obaveze", "obaveza")):
        return "stres oko fakulteta i obaveza"
    if _contains_any(normalized_text, ("depres", "bezvolj", "tuga", "prazno", "praznina", "beznad", "umor")):
        return "te depresivne simptome i težinu koju opisuješ"
    if _contains_any(normalized_text, ("anksio", "tjeskob", "nemir", "panik", "stezanje", "prsima")):
        return "taj nemir i tjeskobu koje opisuješ"
    if _contains_any(normalized_text, ("veza", "cura", "decko", "dečko", "prekid", "odnos")):
        return "to što se događa u tom odnosu"
    excerpt = _short_user_excerpt(raw_text)
    if excerpt:
        return f"ovo što si upravo napisao/la: „{excerpt}”"
    return "to što ti je sada na umu"


def _infer_categories_from_session(session, user_text: str) -> tuple[str, list[str]]:
    if session.main_category.strip() or session.subcategories:
        return session.main_category, session.subcategories

    text_parts = [user_text]

    summary = getattr(session, "summary", None)
    if summary and getattr(summary, "content", ""):
        text_parts.append(summary.content)

    recent_student_messages = session.messages.filter(sender=session.messages.model.SENDER_STUDENT).order_by("-sequence")[:4]
    text_parts.extend(msg.content for msg in recent_student_messages if msg.content)

    combined = " ".join(text_parts).casefold()

    keyword_rules = {
        "Stres i akademski pritisci": {
            "keywords": ("faks", "fakultet", "ispit", "ispiti", "rok", "rokovi", "učenje", "ucenje", "obaveze", "akadem"),
            "subcategories": {
                "Preopterećenost obavezama": ("preoptere", "previše toga", "previse toga", "nakupilo", "obaveze", "obaveza"),
                "Strah od ispita i loših ocjena": ("strah od ispita", "ocjene", "pad", "pasti ispit", "loše ocjene", "lose ocjene"),
                "Problemi s organizacijom vremena i prokrastinacija": ("prokrast", "organizacij", "kasnim", "ne stižem", "ne stizem"),
            },
        },
        "Anksiozni poremećaji": {
            "keywords": ("anksio", "tjeskob", "nemir", "panik", "stezanje", "prsima"),
            "subcategories": {
                "Panični napadi": ("panič", "panic", "napad panike"),
                "Socijalna anksioznost (strah od javnog nastupa, kontakta s profesorima/vršnjacima)": ("javni nastup", "profesor", "vršnjac", "vrsnjac", "socijaln"),
            },
        },
        "Depresivni simptomi": {
            "keywords": ("depres", "bezvolj", "tuga", "prazno", "praznina", "beznad", "beznadez", "umor", "nista mi se ne da"),
            "subcategories": {
                "Tuga, gubitak interesa za aktivnosti": ("bezvolj", "tuga", "tuzan", "tužan", "gubitak interesa", "nista mi se ne da", "ništa mi se ne da"),
                "Nisko samopouzdanje i osjećaj bespomoćnosti": ("bezvrijed", "kriv", "krivnja", "bespomoc", "bespomoć"),
                "Umor i demotivacija": ("umor", "demotiv", "iscrpljen", "iscrpljena"),
            },
        },
        "Trauma i stresne životne situacije": {
            "keywords": ("obitelj", "mama", "tata", "roditelj", "baka", "deda", "gubitak", "zlostavlj"),
            "subcategories": {
                "Obiteljski problemi ili zlostavljanje": ("obitelj", "mama", "tata", "roditelj", "baka", "deda", "zlostavlj"),
                "Gubitak bliske osobe": ("gubitak", "umro", "umrla", "smrt"),
            },
        },
    }

    inferred_main = ""
    inferred_subcategories: list[str] = []

    for category_label, config in keyword_rules.items():
        if _contains_any(combined, config["keywords"]):
            inferred_main = category_label
            for subcategory_label, subcategory_keywords in config["subcategories"].items():
                if _contains_any(combined, subcategory_keywords):
                    inferred_subcategories.append(subcategory_label)
            break

    if not inferred_main:
        normalized_categories = {
            category.label.casefold(): category
            for category in HelpCategory.objects.select_related("parent").all()
        }
        for label, category in normalized_categories.items():
            if label and label in combined:
                if category.parent:
                    inferred_main = category.parent.label
                    inferred_subcategories = [category.label]
                else:
                    inferred_main = category.label
                break

    valid_subcategories = list(
        HelpCategory.objects.filter(parent__label=inferred_main, label__in=inferred_subcategories).values_list("label", flat=True)
    ) if inferred_main and inferred_subcategories else []

    return inferred_main, valid_subcategories


def _recent_student_text(session, limit: int = 4) -> str:
    recent_student_messages = session.messages.filter(
        sender=session.messages.model.SENDER_STUDENT
    ).order_by("-sequence", "-created_at")[:limit]
    ordered = reversed(list(recent_student_messages))
    return " ".join(msg.content for msg in ordered if msg.content)


def _crisis_fallback_result(session, lower: str) -> AssistantLLMResult:
    recent_student_text = _normalize_text(_recent_student_text(session))
    combined = " ".join(part for part in [recent_student_text, lower] if part).strip()
    has_imminent_risk = _contains_any(
        combined,
        ("veceras", "večeras", "odmah", "sad cu", "sad ću", "upravo sada", "imam plan", "napravim si"),
    )
    stabilizing_signals = _contains_any(
        combined,
        (
            "nisam sam",
            "nisam sama",
            "sa nekim sam",
            "s nekim sam",
            "malo se smirilo",
            "preopterecen",
            "preopterećen",
            "nakupilo",
            "stres oko faksa",
            "stres oko fakulteta",
        ),
    )

    if _contains_any(lower, ("zasto se ponavljas", "zašto se ponavljaš", "ponavljas", "ponavljaš")):
        message = (
            "U pravu si, to zvuči ponavljajuće. Ne želim ti zvučati kao automat. Hajdemo samo korak po korak. "
            "Gdje si sada i možeš li sjesti ili stati na mjesto gdje ti je barem malo mirnije dok ostaneš sa mnom ovdje?"
        )
    elif has_imminent_risk:
        message = (
            "Hvala ti što si to rekao. Ako misliš da bi si mogao nauditi večeras ili odmah, ovo više nije trenutak da ostaneš sam s tim. "
            "Nazovi odmah 112 ili Centar za krizna stanja i prevenciju suicida na 01 2376 335, a dok si ovdje napiši mi jesi li uz sebe već pripremio nešto čime bi si mogao nauditi."
        )
    elif stabilizing_signals and _contains_any(combined, ("nisam sam", "nisam sama", "sa nekim sam", "s nekim sam")):
        message = (
            "Dobro je da nisi sam/a. To mi je važno čuti. Hajdemo sada ostati na ovome što te preplavilo i malo spustiti intenzitet trenutka. "
            "Ostani blizu toj osobi ako možeš, ne moraš joj odmah sve objašnjavati, i reci mi što te oko faksa ili obaveza trenutno najviše pritišće."
        )
    elif _contains_any(lower, ("sam sam", "sama sam")) and _contains_any(lower, ("nikom ne vjerujem", "ne vjerujem nikome", "nemam kome", "nikome")):
        message = (
            "Hvala ti što si mi to rekao. Kad si sam i nemaš osobu kojoj sada vjeruješ, idemo samo kroz idućih nekoliko minuta. "
            "Reci mi gdje si sada i možeš li sjesti ili prijeći na mjesto koje ti djeluje barem malo mirnije dok ostaneš ovdje sa mnom."
        )
    elif _contains_any(lower, ("sam sam", "sama sam")):
        message = (
            "Hvala ti što si mi rekao da si sada sam. To mi je važno znati. Reci mi samo gdje si sada i možeš li sjesti ili stati na mjesto gdje ti je barem malo mirnije dok ostaneš sa mnom."
        )
    elif _contains_any(lower, ("nikom ne vjerujem", "ne vjerujem nikome", "nemam kome", "nikome")):
        message = (
            "Razumijem da ti sada ne djeluje kao da postoji osoba kojoj možeš vjerovati. Onda idemo sasvim kratko i polako. "
            "Reci mi gdje si sada i možeš li ostati sa mnom ovdje još nekoliko minuta da prođemo ovo zajedno korak po korak."
        )
    elif _contains_any(combined, ("zeli se ubiti", "zelim se ubiti", "hoću se ubiti", "hocu se ubiti", "ne zelim zivjeti", "ne želim živjeti")):
        message = (
            "Žao mi je što ti je ovako teško. Drago mi je da si mi to rekao. Ostani sa mnom ovdje. "
            "Reci mi samo jedno za početak: jesi li sada sam/a i gdje se trenutno nalaziš? Ako osjetiš da bi si mogao/la odmah nauditi, odmah nazovi 112 ili Centar za krizna stanja i prevenciju suicida na 01 2376 335."
        )
    else:
        message = (
            "Drago mi je da si mi to rekao. Ne moraš sad sve objašnjavati odjednom. Ostani sa mnom ovdje još malo. "
            "Reci mi samo gdje si sada i možeš li ostati u razgovoru sa mnom još nekoliko minuta."
        )

    return AssistantLLMResult(
        mode="crisis",
        message=message,
        summary="Student opisuje ozbiljan emocionalni distres i mogući krizni rizik.",
        main_category_code="11",
        main_category="KRIZNE SITUACIJE (RIZIK)",
        danger_flag=True,
        should_store_summary=True,
    )


def _fallback_result(session, user_text: str) -> AssistantLLMResult:
    lower = _normalize_text(user_text)
    focus_phrase = _context_focus_phrase(lower, user_text)
    inferred_main_category, inferred_subcategories = _infer_categories_from_session(session, user_text)
    effective_main_category = session.main_category or inferred_main_category
    effective_subcategories = session.subcategories or inferred_subcategories
    effective_main_category_code, effective_subcategory_codes, effective_main_category, effective_subcategories = resolve_category_selection(
        main_category_code=getattr(session, "main_category_code", ""),
        subcategory_codes=getattr(session, "subcategory_codes", []),
        main_category_label=effective_main_category,
        subcategory_labels=effective_subcategories,
    )

    wants_psychologist = _contains_any(
        lower,
        (
            "psiholog",
            "psihologa",
            "preporuci",
            "preporuči",
            "predlozi psihologe",
            "predloži psihologe",
        ),
    )
    crisis = bool(getattr(session, "danger_flag", False)) or _contains_any(
        lower,
        (
            "ubiti",
            "samouboj",
            "suicid",
            "ne zelim zivjeti",
            "ne želim živjeti",
            "nauditi sebi",
        ),
    )

    if crisis:
        return _crisis_fallback_result(session, lower)

    if _contains_any(
        lower,
        (
            "kako si",
            "kak si",
            "kako ide",
            "jesi tu",
            "jesi li tu",
            "dali me cujes",
            "da li me cujes",
            "cujes li me",
            "jel me cujes",
            "jel me slusas",
            "slusas li me",
        ),
    ):
        return AssistantLLMResult(
            mode="support",
            main_category_code=effective_main_category_code,
            main_category=effective_main_category,
            subcategory_codes=effective_subcategory_codes,
            subcategories=effective_subcategories,
            message=(
                "Tu sam i čujem te. Možemo nastaviti normalno. Ako želiš, reci mi što ti je danas na umu ili što te trenutno muči."
            ),
        )

    if (_looks_like_greeting(lower) or _contains_any(lower, ("dobar dan",))) and len(lower.split()) <= 4:
        return AssistantLLMResult(
            mode="support",
            main_category_code=effective_main_category_code,
            main_category=effective_main_category,
            subcategory_codes=effective_subcategory_codes,
            subcategories=effective_subcategories,
            message=(
                "Bok. Tu sam. Ako želiš, možeš mi napisati što ti je danas na umu ili zbog čega si se javio."
            ),
        )

    if wants_psychologist:
        if effective_main_category.strip() or effective_subcategories:
            return AssistantLLMResult(
                mode="recommendation_ready",
                main_category_code=effective_main_category_code,
                message=(
                    f"Na temelju onoga što si do sada podijelio/la o temi {focus_phrase}, mogu ti odmah predložiti nekoliko psihologa "
                    "koji se bave ovakvim temama."
                ),
                summary=(
                    "Student želi preporuku psihologa nakon razgovora o vlastitim teškoćama."
                ),
                main_category=effective_main_category,
                subcategory_codes=effective_subcategory_codes,
                subcategories=effective_subcategories,
                should_end_session=True,
                should_show_recommendations=True,
                should_store_summary=True,
            )
        return AssistantLLMResult(
            mode="recommendation_offer",
            message=(
                "Mogu ti pomoći pronaći psihologa. Prije nego ti nešto konkretno predložim, reci mi samo "
                f"što te u vezi s temom {focus_phrase} trenutno najviše muči ili zbog čega misliš da bi ti razgovor dobro došao."
            ),
        )

    if _contains_any(lower, ("faks", "fakultet", "ispit", "ispiti", "rok", "rokovi", "učenje", "obaveze")):
        return AssistantLLMResult(
            mode="support",
            main_category_code=effective_main_category_code,
            main_category=effective_main_category,
            subcategory_codes=effective_subcategory_codes,
            subcategories=effective_subcategories,
            message=(
                "Zvuči kao da te dosta pritišću fakultet, ispiti i obaveze. Ne moramo to odmah sve razmrsiti odjednom. "
                "Što ti je u tome trenutno najteže: pritisak, strah od neuspjeha ili osjećaj da se svega nakupilo previše?"
            ),
        )

    if _contains_any(lower, ("obitelj", "mama", "tata", "roditelj", "deda", "baka", "sestra", "brat")):
        return AssistantLLMResult(
            mode="support",
            main_category_code=effective_main_category_code,
            main_category=effective_main_category,
            subcategory_codes=effective_subcategory_codes,
            subcategories=effective_subcategories,
            message=(
                f"Žao mi je što prolaziš kroz {focus_phrase}. Takve stvari znaju baš teško pasti jer su nam bliske. "
                "Ako želiš, reci mi što te u toj situaciji najviše opterećuje."
            ),
        )

    if _contains_any(lower, ("anksio", "panik", "tjeskob", "nemir", "stezanje", "prsima")):
        return AssistantLLMResult(
            mode="support",
            main_category_code=effective_main_category_code,
            main_category=effective_main_category,
            subcategory_codes=effective_subcategory_codes,
            subcategories=effective_subcategories,
            message=(
                f"To zvuči iscrpljujuće. Kad te preplavi {focus_phrase}, često najviše pomogne da prvo uhvatimo što ga najjače pokreće. "
                "Kada ti to obično bude najizraženije?"
            ),
        )

    if _contains_any(lower, ("depres", "bezvolj", "tuga", "prazno", "praznina", "beznad", "beznadez", "umor")):
        return AssistantLLMResult(
            mode="support",
            main_category_code=effective_main_category_code,
            main_category=effective_main_category,
            subcategory_codes=effective_subcategory_codes,
            subcategories=effective_subcategories,
            message=(
                f"Žao mi je što prolaziš kroz {focus_phrase}. Takvi simptomi znaju čovjeka dosta utišati i iscrpiti. "
                "Reci mi, je li to kod tebe više osjećaj tuge i bezvoljnosti, ili više osjećaj da si se potpuno ispraznio/la i nemaš snage ni za što?"
            ),
        )

    return AssistantLLMResult(
        mode="support",
        message=(
            f"Tu sam i možemo nastaviti odavde. Ako želiš, reci mi malo više o tome kako ti trenutno izgleda {focus_phrase} "
            "ili što ti je u svemu tome najteže."
        ),
        main_category_code=effective_main_category_code,
        main_category=effective_main_category,
        subcategory_codes=effective_subcategory_codes,
        subcategories=effective_subcategories,
    )


def _quota_exhausted_result(session) -> AssistantLLMResult:
    return AssistantLLMResult(
        mode="support",
        message=(
            "Ovo je demo testiranje i trenutno je ponestalo API kredita. Kontaktirajte admina."
        ),
        main_category_code=getattr(session, "main_category_code", ""),
        main_category=session.main_category,
        subcategory_codes=getattr(session, "subcategory_codes", []),
        subcategories=session.subcategories,
    )


def _build_session_memory(messages) -> str:
    snippets: list[str] = []
    for msg in messages[-12:]:
        speaker = "Student" if msg.sender == msg.SENDER_STUDENT else "Julija"
        snippet = " ".join((msg.content or "").split())
        if len(snippet) > 160:
            snippet = f"{snippet[:157]}..."
        if snippet:
            snippets.append(f"{speaker}: {snippet}")
    return " | ".join(snippets)


def build_messages_for_llm(session, recent_summaries: list[str]) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": build_system_prompt()}]

    student_user = session.student.user
    sex = getattr(student_user, "sex", None)
    if sex:
        messages.append(
            {
                "role": "system",
                "content": (
                    "Dodatni tihi kontekst o korisniku: poznat je podatak o spolu iz profila. "
                    f"Vrijednost je: {sex}. Koristi to samo ako prirodno pomaže jeziku i tonu. "
                    "Ne spominji da znaš podatke iz profila i ne koristi ime korisnika."
                ),
            }
        )

    if recent_summaries:
        context = "\n".join(f"- {item}" for item in recent_summaries if item.strip())
        messages.append(
            {
                "role": "system",
                "content": (
                    "Tihi kontekst iz proslih razgovora. Koristi ga samo kao pozadinsko razumijevanje, "
                    "nemoj ga samoinicijativno spominjati studentu osim ako prirodno proizlazi iz razgovora:\n"
                    f"{context}"
                ),
            }
        )

    session_messages = list(session.messages.order_by("sequence", "created_at"))
    max_recent_messages = _max_recent_messages()
    if len(session_messages) > max_recent_messages:
        older_messages = session_messages[:-max_recent_messages]
        older_summary = _build_session_memory(older_messages)
        if older_summary:
            messages.append(
                {
                    "role": "system",
                    "content": (
                        "Sažetak ranijeg dijela ovog razgovora. Koristi ga kao kontekst, "
                        "ali nastavi razgovor prirodno i fokusiraj se na zadnje poruke:\n"
                        f"{older_summary}"
                    ),
                }
            )
        session_messages = session_messages[-max_recent_messages:]

    for msg in session_messages:
        role = "user" if msg.sender == msg.SENDER_STUDENT else "assistant"
        messages.append({"role": role, "content": msg.content})

    return messages


def generate_assistant_result(session, recent_summaries: list[str]) -> AssistantLLMResult:
    last_student_message = (
        session.messages.filter(sender=session.messages.model.SENDER_STUDENT)
        .order_by("-sequence", "-created_at")
        .first()
    )
    user_text = last_student_message.content if last_student_message else ""

    try:
        trimmed_summaries = recent_summaries[: _max_previous_summaries()]
        messages = build_messages_for_llm(session, trimmed_summaries)
        client = _get_openai_client()
        max_attempts = _max_attempts()
        primary_models = [(_conversation_model(), _conversation_timeout())] * max_attempts
        backup_models = [(_backup_conversation_model(), _backup_conversation_timeout())]
        model_attempts = primary_models + backup_models

        last_error: Exception | None = None

        for attempt, (model, timeout) in enumerate(model_attempts, start=1):
            started_at = perf_counter()
            logger.warning(
                "assistant_llm_start session_id=%s model=%s messages=%s summaries=%s timeout_sec=%.2f attempt=%s",
                session.pk,
                model,
                len(messages),
                len(trimmed_summaries),
                timeout,
                attempt,
            )
            try:
                completion = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    response_format={"type": "json_object"},
                    timeout=timeout,
                )
                duration = perf_counter() - started_at
                logger.warning(
                    "assistant_llm_end session_id=%s model=%s duration_sec=%.2f messages=%s attempt=%s",
                    session.pk,
                    model,
                    duration,
                    len(messages),
                    attempt,
                )
                content = (completion.choices[0].message.content or "").strip()
                payload = json.loads(content)
                return AssistantLLMResult.model_validate(payload)
            except APITimeoutError as exc:
                duration = perf_counter() - started_at
                last_error = exc
                logger.warning(
                    "assistant_llm_timeout session_id=%s model=%s duration_sec=%.2f messages=%s attempt=%s",
                    session.pk,
                    model,
                    duration,
                    len(messages),
                    attempt,
                )
            except Exception as exc:
                duration = perf_counter() - started_at
                last_error = exc
                logger.warning(
                    "assistant_llm_attempt_failed session_id=%s model=%s duration_sec=%.2f messages=%s attempt=%s error=%s",
                    session.pk,
                    model,
                    duration,
                    len(messages),
                    attempt,
                    exc,
                )

        if isinstance(last_error, RateLimitError):
            error_body = getattr(last_error, "body", {}) or {}
            error_code = ((error_body.get("error") or {}).get("code") if isinstance(error_body, dict) else None)
            if error_code == "insufficient_quota":
                logger.warning(
                    "assistant_llm_quota_exhausted session_id=%s model=%s",
                    session.pk,
                    _conversation_model(),
                )
                return _quota_exhausted_result(session)

        if last_error is not None:
            raise last_error
        raise RuntimeError("Assistant completion was not produced")
    except Exception as exc:
        logger.exception(
            "assistant_llm_error session_id=%s model=%s error=%s",
            session.pk,
            _conversation_model(),
            exc,
        )
        logger.warning(
            "assistant_llm_fallback session_id=%s model=%s main_category=%s subcategories=%s",
            session.pk,
            _conversation_model(),
            session.main_category,
            session.subcategories,
        )
        return _fallback_result(session, user_text)
