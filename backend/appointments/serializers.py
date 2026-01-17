from rest_framework import serializers
from .models import AppointmentRequest, Appointment, Availability
from zoneinfo import ZoneInfo
from django.utils import timezone


class AppointmentRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentRequest
        fields = [
            'id', 'student', 'caretaker', 'requested_start', 'requested_end', 'message', 'ai_summary', 'status', 'created_at'
        ]
        read_only_fields = ['ai_summary', 'status', 'created_at']


class AppointmentSerializer(serializers.ModelSerializer):
    meet_link = serializers.CharField(source='conference_link', read_only=True)

    class Meta:
        model = Appointment
        fields = ['id', 'appointment_request', 'caretaker', 'student', 'start', 'end', 'duration_minutes', 'status', 'conference_link', 'meet_link']


class SlotSerializer(serializers.Serializer):
    start = serializers.CharField()
    end = serializers.CharField()
    time = serializers.CharField()
    is_available = serializers.BooleanField()
