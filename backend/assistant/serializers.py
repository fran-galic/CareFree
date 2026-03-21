from rest_framework import serializers

from .models import AssistantSession, AssistantMessage, AssistantSessionSummary
from users.serializers import CaretakerLongSerializer
from accounts.models import Caretaker


class AssistantSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantSession
        fields = [
            "id",
            "is_active",
            "mode",
            "status",
            "closure_reason",
            "main_category_code",
            "main_category",
            "subcategory_codes",
            "subcategories",
            "danger_flag",
            "created_at",
            "ended_at",
        ]


class AssistantMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantMessage
        fields = ["id", "session", "sender", "content", "sequence", "created_at"]
        read_only_fields = ["id", "session", "sender", "sequence", "created_at"]


class AssistantSessionSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantSessionSummary
        fields = [
            "id",
            "student",
            "session",
            "content",
            "summary_type",
            "main_category_code",
            "main_category",
            "subcategory_codes",
            "subcategories",
            "recommended_caretaker_ids",
            "transcript_snapshot",
            "include_in_context",
            "created_at",
        ]
        read_only_fields = ["id", "student", "session", "created_at"]


class ChatMessageRequestSerializer(serializers.Serializer):
    content = serializers.CharField()


class AssistantSummaryListItemSerializer(serializers.ModelSerializer):
    summary_text = serializers.CharField(source="content", read_only=True)

    class Meta:
        model = AssistantSessionSummary
        fields = [
            "id",
            "created_at",
            "summary_text",
            "summary_type",
            "main_category_code",
            "main_category",
            "subcategory_codes",
            "subcategories",
        ]


class SummaryMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantMessage
        fields = ["sender", "content", "created_at", "sequence"]


class AssistantSummaryDetailSerializer(serializers.ModelSerializer):
    summary_text = serializers.CharField(source="content", read_only=True)
    messages = serializers.SerializerMethodField()
    recommended_caretakers = serializers.SerializerMethodField()
    closure_reason = serializers.CharField(source="session.closure_reason", read_only=True)
    session_status = serializers.CharField(source="session.status", read_only=True)

    class Meta:
        model = AssistantSessionSummary
        fields = [
            "id",
            "created_at",
            "summary_text",
            "summary_type",
            "main_category_code",
            "main_category",
            "subcategory_codes",
            "subcategories",
            "recommended_caretakers",
            "messages",
            "closure_reason",
            "session_status",
        ]

    def get_messages(self, obj):
        return obj.transcript_snapshot or []

    def get_recommended_caretakers(self, obj):
        caretaker_ids = [pk for pk in obj.recommended_caretaker_ids if pk]
        if not caretaker_ids:
            return []
        caretakers = Caretaker.objects.filter(pk__in=caretaker_ids, is_approved=True)
        by_id = {
            caretaker.pk: CaretakerLongSerializer(
                caretaker,
                context=self.context,
            ).data
            for caretaker in caretakers
        }
        return [by_id[pk] for pk in caretaker_ids if pk in by_id]
