from rest_framework import serializers

from .models import CalendarEvent


#serializer za CalendarEvent model
class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = [
            "id",
            "calendar",
            "google_event_id",
            "summary",
            "description",
            "start",
            "end",
            "meet_link",
            "raw",
            "synced_at",
            "source_type",
            "source_id",
        ]
