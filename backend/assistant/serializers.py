from rest_framework import serializers

from .models import AssistantSession, AssistantMessage, AssistantSessionSummary


class AssistantSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantSession
        fields = ["id", "is_active", "created_at", "ended_at"]


class AssistantMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantMessage
        fields = ["id", "session", "sender", "content", "sequence", "created_at"]
        read_only_fields = ["id", "session", "sender", "sequence", "created_at"]


class AssistantSessionSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantSessionSummary
        fields = ["id", "student", "session", "content", "created_at"]
        read_only_fields = ["id", "student", "session", "created_at"]


class ChatMessageRequestSerializer(serializers.Serializer):
    content = serializers.CharField()
