import json
import logging
from time import perf_counter

from django.conf import settings
from openai import APITimeoutError, OpenAI

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


def _max_recent_messages() -> int:
    return int(getattr(settings, "AI_MAX_RECENT_CHAT_MESSAGES", 8))


def _max_previous_summaries() -> int:
    return int(getattr(settings, "AI_MAX_PREVIOUS_SUMMARIES", 2))


def _fallback_result(user_text: str) -> AssistantLLMResult:
    lower = user_text.lower()
    wants_psychologist = any(
        phrase in lower
        for phrase in (
            "psiholog",
            "psihologa",
            "preporuci",
            "preporuči",
            "predlozi psihologe",
            "predloži psihologe",
        )
    )
    crisis = any(
        phrase in lower
        for phrase in (
            "ubiti",
            "samouboj",
            "suicid",
            "ne zelim zivjeti",
            "ne želim živjeti",
            "nauditi sebi",
        )
    )

    if crisis:
        return AssistantLLMResult(
            mode="crisis",
            message=(
                "Žao mi je što ti je ovako teško. Važno mi je da sada prvo provjerimo jesi li na sigurnom. "
                "Ako si u neposrednoj opasnosti, odmah nazovi 112 ili Centar za krizna stanja i prevenciju suicida na 01 2376 335. "
                "Ako možeš, napiši mi jesi li sada sam/a i je li uz tebe netko kome vjeruješ."
            ),
            summary="Student opisuje ozbiljan emocionalni distres i mogući krizni rizik.",
            main_category="KRIZNE SITUACIJE (RIZIK)",
            danger_flag=True,
            should_store_summary=True,
        )

    if wants_psychologist:
        return AssistantLLMResult(
            mode="recommendation_ready",
            message=(
                "Naravno. Na temelju ovoga mogu ti predložiti nekoliko psihologa koji se bave ovakvim temama."
            ),
            summary="Student želi preporuku psihologa nakon razgovora o vlastitim teškoćama.",
            should_end_session=True,
            should_show_recommendations=True,
            should_store_summary=True,
        )

    return AssistantLLMResult(
        mode="support",
        message=(
            "Nešto mi je trenutno zapelo, ali možeš mi odmah ponovno napisati još jednom ili nastaviti odavde. "
            "Možeš mi napisati malo više o tome što ti je trenutno najteže ili što ti se najviše vrti po glavi."
        ),
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
        client = _get_openai_client()
        model = _conversation_model()
        trimmed_summaries = recent_summaries[: _max_previous_summaries()]
        messages = build_messages_for_llm(session, trimmed_summaries)
        timeout = _conversation_timeout()

        completion = None
        duration = None
        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
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
                break
            except APITimeoutError:
                duration = perf_counter() - started_at
                logger.warning(
                    "assistant_llm_timeout session_id=%s model=%s duration_sec=%.2f messages=%s attempt=%s",
                    session.pk,
                    model,
                    duration,
                    len(messages),
                    attempt,
                )
                if attempt == max_attempts:
                    raise
                logger.warning(
                    "assistant_llm_retry session_id=%s model=%s attempt=%s",
                    session.pk,
                    model,
                    attempt + 1,
                )
        if completion is None:
            raise RuntimeError("Assistant completion was not produced")
        content = (completion.choices[0].message.content or "").strip()
        payload = json.loads(content)
        return AssistantLLMResult.model_validate(payload)
    except Exception as exc:
        logger.exception(
            "assistant_llm_error session_id=%s model=%s error=%s",
            session.pk,
            _conversation_model(),
            exc,
        )
        return _fallback_result(user_text)
