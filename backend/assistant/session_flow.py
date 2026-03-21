from django.utils import timezone

from .models import AssistantSession, AssistantSessionSummary


def recent_context_summaries(student, limit: int = 3) -> list[str]:
    return list(
        AssistantSessionSummary.objects.filter(student=student, include_in_context=True)
        .order_by("-created_at")
        .values_list("content", flat=True)[:limit]
    )


def update_session_from_result(session, result) -> None:
    mode_map = {
        "crisis": AssistantSession.SessionMode.CRISIS,
        "recommendation_offer": AssistantSession.SessionMode.RECOMMENDATION,
        "recommendation_ready": AssistantSession.SessionMode.RECOMMENDATION,
        "support_closure": AssistantSession.SessionMode.SUPPORT,
        "support": AssistantSession.SessionMode.SUPPORT,
    }
    status_map = {
        "crisis": AssistantSession.SessionStatus.CRISIS_ACTIVE,
        "recommendation_offer": AssistantSession.SessionStatus.RECOMMENDATION_OFFERED,
        "recommendation_ready": AssistantSession.SessionStatus.RECOMMENDATION_READY,
        "support_closure": AssistantSession.SessionStatus.SUPPORT_COMPLETED,
        "support": AssistantSession.SessionStatus.ACTIVE,
    }
    session.mode = mode_map.get(result.mode, AssistantSession.SessionMode.SUPPORT)
    session.status = status_map.get(result.mode, AssistantSession.SessionStatus.ACTIVE)
    session.main_category = (result.main_category or "").strip()
    session.subcategories = [item for item in result.subcategories if item]
    session.danger_flag = bool(result.danger_flag)
    session.save(
        update_fields=[
            "mode",
            "status",
            "main_category",
            "subcategories",
            "danger_flag",
            "updated_at",
        ]
    )


def close_session(session, closure_reason: str) -> None:
    session.is_active = False
    session.ended_at = timezone.now()
    session.closure_reason = closure_reason

    if closure_reason == AssistantSession.ClosureReason.MANUAL:
        session.status = AssistantSession.SessionStatus.ENDED_MANUAL
    elif closure_reason == AssistantSession.ClosureReason.RECOMMENDATION:
        session.status = AssistantSession.SessionStatus.RECOMMENDATION_COMPLETED
    elif closure_reason == AssistantSession.ClosureReason.CRISIS:
        session.status = AssistantSession.SessionStatus.CRISIS_ACTIVE
    else:
        session.status = AssistantSession.SessionStatus.SUPPORT_COMPLETED

    session.save(
        update_fields=[
            "is_active",
            "ended_at",
            "closure_reason",
            "status",
            "updated_at",
        ]
    )


def ensure_summary(
    session,
    *,
    content: str,
    summary_type: str,
    recommended_caretaker_ids: list[int] | None = None,
) -> AssistantSessionSummary:
    summary, _ = AssistantSessionSummary.objects.update_or_create(
        session=session,
        defaults={
            "student": session.student,
            "content": content.strip(),
            "summary_type": summary_type,
            "main_category": session.main_category,
            "subcategories": session.subcategories,
            "recommended_caretaker_ids": recommended_caretaker_ids or [],
            "include_in_context": True,
        },
    )
    return summary


def default_manual_summary(session) -> str:
    student_messages = session.messages.filter(sender=session.messages.model.SENDER_STUDENT).order_by(
        "sequence", "created_at"
    )
    if not student_messages.exists():
        return "Razgovor je završen bez dodatnih poruka."
    first = student_messages.first().content.strip()
    last = student_messages.last().content.strip()
    if first == last:
        return f"Student je podijelio sljedeće tijekom razgovora: {first}"
    return f"Student je tijekom razgovora podijelio više tema. Početak: {first} Kraj: {last}"
