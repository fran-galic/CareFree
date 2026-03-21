from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .llm import generate_assistant_result
from .models import AssistantMessage, AssistantSession, AssistantSessionSummary
from .prompts import WELCOME_MESSAGE
from .recommendations import build_recommendation_summary_text, find_recommended_caretakers
from .serializers import (
    AssistantMessageSerializer,
    AssistantSessionSerializer,
    AssistantSummaryDetailSerializer,
    AssistantSummaryListItemSerializer,
    ChatMessageRequestSerializer,
)
from .session_flow import (
    close_session,
    default_manual_summary,
    ensure_summary,
    recent_context_summaries,
    update_session_from_result,
)


def _get_student_from_request(request):
    user = request.user
    return getattr(user, "student", None)


def _normalize_text(value: str) -> str:
    return " ".join((value or "").casefold().split())


def _student_clearly_wants_to_stop(content: str) -> bool:
    normalized = _normalize_text(content)
    strong_closure_phrases = (
        "to je to",
        "ma to je to",
        "to je sve",
        "ma to je sve",
        "za danas mi je dosta",
        "to je to za danas",
        "mozemo stati",
        "možemo stati",
        "mozemo ovdje stati",
        "možemo ovdje stati",
        "mislim da mi je za danas dosta",
        "ne trebam dalje nista",
        "ne trebam dalje ništa",
        "to mi je dovoljno za danas",
        "dosta mi je za danas",
        "sve je u redu",
        "sve je okej",
        "mislim da sam okej",
        "mislim da je okej",
        "hvala, to je to",
        "hvala to je to",
    )
    return any(phrase in normalized for phrase in strong_closure_phrases)


def _session_intro_payload() -> dict:
    return {
        "welcome_message": WELCOME_MESSAGE,
        "can_recommend_psychologists": True,
        "crisis_contacts": {
            "urgent": "112",
            "crisis_center": "01 2376 335",
            "plavi_telefon": "01 4833 888",
        },
    }


class StartSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        student = _get_student_from_request(request)
        if student is None:
            return Response({"message": "Korisnik nije student."}, status=status.HTTP_403_FORBIDDEN)

        session = AssistantSession.objects.filter(student=student, is_active=True).first()
        created = False
        if session is None:
            session = AssistantSession.objects.create(student=student)
            created = True

        messages = AssistantMessage.objects.filter(session=session).order_by("sequence", "created_at")
        return Response(
            {
                "session": AssistantSessionSerializer(session).data,
                "messages": AssistantMessageSerializer(messages, many=True).data,
                "created": created,
                "ui_hint": _session_intro_payload(),
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class EndSesssionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        student = _get_student_from_request(request)
        if student is None:
            return Response({"message": "Korisnik nije student."}, status=status.HTTP_403_FORBIDDEN)

        session = AssistantSession.objects.filter(student=student, is_active=True).first()
        if session is None:
            return Response(
                {"message": "Nema aktivne sesije za ovog studenta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not session.messages.filter(sender=AssistantMessage.SENDER_STUDENT).exists():
            return Response(
                {"message": "Razgovor još nije započeo jer student nije poslao poruku."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        summary = getattr(session, "summary", None)
        if summary is None:
            summary = ensure_summary(
                session,
                content=default_manual_summary(session),
                summary_type=AssistantSessionSummary.SummaryType.SUPPORT,
            )
        close_session(session, AssistantSession.ClosureReason.MANUAL)

        return Response(
            {
                "message": "Razgovor je uspješno završen.",
                "session_closed": True,
                "session_status": session.status,
                "summary_id": summary.id,
            },
            status=status.HTTP_200_OK,
        )


class SessionMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatMessageRequestSerializer

    def post(self, request, *args, **kwargs):
        student = _get_student_from_request(request)
        if student is None:
            return Response({"message": "Korisnik nije student."}, status=status.HTTP_403_FORBIDDEN)

        session = AssistantSession.objects.filter(student=student, is_active=True).first()
        if session is None:
            return Response(
                {"message": "Nema aktivne sesije. Pokrenite sesiju prije slanja poruka."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request_serializer = self.serializer_class(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        content = request_serializer.validated_data["content"]

        user_message = AssistantMessage.objects.create(
            session=session,
            sender=AssistantMessage.SENDER_STUDENT,
            content=content,
        )

        result = generate_assistant_result(session, recent_context_summaries(student))

        if result.mode == "support_closure" and not _student_clearly_wants_to_stop(content):
            result.mode = "support"
            result.should_end_session = False
            result.should_store_summary = False
            result.message = (
                "Ako želiš, možemo ovdje polako stati za danas, ali ne moramo. "
                "Ako ti se još priča, slobodno nastavi i reci mi što ti je još ostalo na umu."
            )

        update_session_from_result(session, result)

        bot_message = AssistantMessage.objects.create(
            session=session,
            sender=AssistantMessage.SENDER_BOT,
            content=(result.message or "").strip(),
        )

        recommended_caretaker_ids: list[int] = []
        recommended_caretakers = []
        recommendation_match_scope = "general"
        recommendation_summary_text = ""
        summary = getattr(session, "summary", None)

        if result.should_show_recommendations:
            recommended_caretaker_ids, recommended_caretakers, recommendation_match_scope = find_recommended_caretakers(
                session.main_category,
                session.subcategories,
                main_category_code=session.main_category_code,
                subcategory_codes=session.subcategory_codes,
                request=request,
            )

            if not session.main_category_code and not session.main_category.strip():
                result.mode = "recommendation_offer"
                result.should_show_recommendations = False
                result.should_end_session = False
                result.should_store_summary = False
                result.message = (
                    "Mogu ti pomoći pronaći psihologa, ali prije toga bi mi koristilo da malo bolje "
                    "razumijem što te najviše muči. Što ti je trenutno najteže ili što ti se najčešće vrti po glavi?"
                )
                update_session_from_result(session, result)
                bot_message.content = result.message
                bot_message.save(update_fields=["content"])
            else:
                recommendation_summary_text = build_recommendation_summary_text(
                    (result.summary or "").strip(),
                    session.main_category,
                    session.subcategories,
                    recommendation_match_scope,
                )
                if session.danger_flag or result.mode == "crisis":
                    result.message = (
                        "Uz ove krizne kontakte, izdvojila sam i nekoliko psihologa koji ti mogu pružiti dodatnu stručnu podršku "
                        "čim budeš spreman/na. Ako osjetiš da si sada u neposrednoj opasnosti, hitni brojevi su i dalje prvi korak."
                    )
                    bot_message.content = result.message
                    bot_message.save(update_fields=["content"])
            if (
                recommendation_match_scope == "general"
                and result.should_show_recommendations
                and recommended_caretakers
                and not (session.danger_flag or result.mode == "crisis")
            ):
                result.message = (
                    "Nisam uspjela izdvojiti dovoljno precizan uži krug, ali mogu ti odmah pokazati nekoliko "
                    "dostupnih psihologa pa možeš vidjeti tko ti najviše odgovara."
                )
                bot_message.content = result.message
                bot_message.save(update_fields=["content"])
            elif result.should_show_recommendations and not recommended_caretakers:
                result.mode = "recommendation_offer"
                result.should_show_recommendations = False
                result.should_end_session = False
                result.should_store_summary = False
                result.message = (
                    "Trenutno ti ne mogu prikazati odgovarajuće psihologe, ali mogu ostati s tobom u razgovoru "
                    "ili možeš malo kasnije pokušati ponovno."
                )
                update_session_from_result(session, result)
                bot_message.content = result.message
                bot_message.save(update_fields=["content"])

        if result.should_store_summary:
            summary_type = AssistantSessionSummary.SummaryType.SUPPORT
            if result.mode == "crisis":
                summary_type = AssistantSessionSummary.SummaryType.CRISIS
            elif result.should_show_recommendations:
                summary_type = AssistantSessionSummary.SummaryType.RECOMMENDATION

            summary_content = (result.summary or "").strip() or default_manual_summary(session)
            summary = ensure_summary(
                session,
                content=summary_content,
                summary_type=summary_type,
                recommended_caretaker_ids=recommended_caretaker_ids,
            )

        if result.should_end_session:
            closure_reason = AssistantSession.ClosureReason.SUPPORT
            if result.mode == "crisis":
                closure_reason = AssistantSession.ClosureReason.CRISIS
            elif result.should_show_recommendations:
                closure_reason = AssistantSession.ClosureReason.RECOMMENDATION
            close_session(session, closure_reason)

        response_payload = {
            "user_message": AssistantMessageSerializer(user_message).data,
            "bot_message": AssistantMessageSerializer(bot_message).data,
            "session_mode": session.mode,
            "session_status": session.status,
            "danger_flag": session.danger_flag,
            "show_crisis_panel": session.danger_flag,
            "show_recommendations": bool(result.should_show_recommendations),
            "recommended_caretakers": recommended_caretakers,
            "recommendation_summary": recommendation_summary_text,
            "recommendation_match_scope": recommendation_match_scope if result.should_show_recommendations else None,
            "session_closed": not session.is_active,
            "summary_id": getattr(summary, "id", None),
            "ui_hint": _session_intro_payload(),
        }
        return Response(response_payload, status=status.HTTP_201_CREATED)


class AssistantSummaryListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AssistantSummaryListItemSerializer

    def get_queryset(self):
        student = _get_student_from_request(self.request)
        if student is None:
            return AssistantSessionSummary.objects.none()
        return AssistantSessionSummary.objects.filter(student=student).order_by("-created_at")


class AssistantSummaryDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AssistantSummaryDetailSerializer

    def get_queryset(self):
        student = _get_student_from_request(self.request)
        if student is None:
            return AssistantSessionSummary.objects.none()
        return AssistantSessionSummary.objects.filter(student=student)
