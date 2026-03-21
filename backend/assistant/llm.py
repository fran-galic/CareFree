import json

from django.conf import settings
from openai import OpenAI

from .prompts import build_system_prompt
from .schemas import AssistantLLMResult


def _get_openai_client() -> OpenAI:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def _conversation_model() -> str:
    return getattr(settings, "AI_CONVERSATION_MODEL", "gpt-5.2-chat-latest")


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
                "Žao mi je što ti je ovako teško. Drago mi je da si to rekao/la. "
                "Ako si sada u neposrednoj opasnosti, odmah nazovi 112 ili Centar za krizna stanja i prevenciju suicida na 01 2376 335. "
                "Možeš mi i reći jesi li sada sam/a i jesi li na sigurnom."
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
            "Tu sam uz tebe. Ako želiš, reci mi malo više o tome što ti je ovih dana najteže ili što ti se najviše vrti po glavi."
        ),
    )


def build_messages_for_llm(session, recent_summaries: list[str]) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": build_system_prompt()}]

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

    for msg in session.messages.order_by("sequence", "created_at"):
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
        completion = client.chat.completions.create(
            model=_conversation_model(),
            messages=build_messages_for_llm(session, recent_summaries),
            response_format={"type": "json_object"},
        )
        content = (completion.choices[0].message.content or "").strip()
        payload = json.loads(content)
        return AssistantLLMResult.model_validate(payload)
    except Exception:
        return _fallback_result(user_text)
