from django.utils import timezone

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AssistantSession, AssistantMessage, AssistantSessionSummary
from .serializers import (
    AssistantSessionSerializer,
    AssistantMessageSerializer,
    AssistantSessionSummarySerializer,
    ChatMessageRequestSerializer,
)


def _get_student_from_request(request):
    user = request.user
    student = getattr(user, "student", None)
    return student


def generate_bot_reply(session: AssistantSession, user_message: AssistantMessage) -> str:
    """Placeholder bot reply logic.

    TODO: Zamijeniti pravom AI logikom.
    """
    return "Ovo je automatski odgovor chatbota."


def generate_session_summary(session: AssistantSession) -> str:
    """Generate a simple textual summary of a session.

    TODO: Zamijeniti pravom AI sumarizacijom.
    """
    messages = session.messages.order_by("sequence")
    total = messages.count()
    if total == 0:
        return "Sesija nema poruka."
    first = messages.first().content[:100]
    last = messages.last().content[:100]
    return f"Sesija ima {total} poruka. Prva poruka: '{first}'. Zadnja poruka: '{last}'."


class StartSesssionView(APIView):
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

        serializer = AssistantSessionSerializer(session)
        return Response(
            serializer.data,
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

        session.is_active = False
        session.ended_at = timezone.now()
        session.save(update_fields=["is_active", "ended_at", "updated_at"])

        summary, created = AssistantSessionSummary.objects.get_or_create(
            student=student,
            session=session,
            defaults={"content": generate_session_summary(session)},
        )
        # if not created:
        #     # optionally refresh summary content
        #     summary.content = generate_session_summary(session)
        #     summary.save(update_fields=["content"])

        serializer = AssistantSessionSummarySerializer(summary)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SessionMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChatMessageRequestSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)

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

        bot_text = generate_bot_reply(session, user_message)
        bot_message = AssistantMessage.objects.create(
            session=session,
            sender=AssistantMessage.SENDER_BOT,
            content=bot_text,
        )

        user_message_data = AssistantMessageSerializer(user_message).data
        bot_message_data = AssistantMessageSerializer(bot_message).data

        #potrebna je samo bot poruka
        return Response(
            {"user_message": user_message_data, "bot_message": bot_message_data},
            status=status.HTTP_201_CREATED,
        )


class AssistantSummaryListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AssistantSessionSummarySerializer

    def get_queryset(self):
        student = _get_student_from_request(self.request)
        if student is None:
            return AssistantSessionSummary.objects.none()
        return (
            AssistantSessionSummary.objects.filter(student=student)
            .order_by("-created_at")
        )


class AssistantSummaryDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AssistantSessionSummarySerializer

    def get_queryset(self):
        student = _get_student_from_request(self.request)
        if student is None:
            return AssistantSessionSummary.objects.none()
        return AssistantSessionSummary.objects.filter(student=student)