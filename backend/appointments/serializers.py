from rest_framework import serializers
from .models import AppointmentRequest, Appointment, Availability, AppointmentFeedback
from zoneinfo import ZoneInfo
from django.utils import timezone


class StudentInfoSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)


class CaretakerInfoSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)


class AppointmentFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentFeedback
        fields = [
            "status",
            "selected_response",
            "comment",
            "created_at",
            "updated_at",
        ]


class AppointmentRequestSerializer(serializers.ModelSerializer):
    student = StudentInfoSerializer(read_only=True)
    caretaker = CaretakerInfoSerializer(read_only=True)
    student_id = serializers.IntegerField(write_only=True, required=False)
    caretaker_id = serializers.IntegerField(write_only=True, required=False)
    appointment_id = serializers.SerializerMethodField()
    appointment_status = serializers.SerializerMethodField()
    appointment_conference_link = serializers.SerializerMethodField()
    appointment_feedback = serializers.SerializerMethodField()
    
    class Meta:
        model = AppointmentRequest
        fields = [
            'id', 'student', 'student_id', 'caretaker', 'caretaker_id', 
            'requested_start', 'requested_end', 'message', 'ai_summary', 
            'status', 'created_at', 'appointment_id', 'appointment_status', 'appointment_conference_link', 'appointment_feedback'
        ]
        read_only_fields = ['ai_summary', 'status', 'created_at']

    def _get_appointment(self, obj):
        try:
            return obj.appointment
        except Appointment.DoesNotExist:
            return None

    def get_appointment_id(self, obj):
        appointment = self._get_appointment(obj)
        return appointment.id if appointment else None

    def get_appointment_status(self, obj):
        appointment = self._get_appointment(obj)
        return appointment.status if appointment else None

    def get_appointment_conference_link(self, obj):
        appointment = self._get_appointment(obj)
        return appointment.conference_link if appointment else None

    def get_appointment_feedback(self, obj):
        appointment = self._get_appointment(obj)
        if not appointment:
            return None

        feedback = getattr(appointment, "feedback", None)
        if not feedback or feedback.status != AppointmentFeedback.STATUS_SUBMITTED:
            return None

        return AppointmentFeedbackSerializer(feedback).data


class AppointmentSerializer(serializers.ModelSerializer):
    meet_link = serializers.CharField(source='conference_link', read_only=True)
    student = StudentInfoSerializer(read_only=True)
    caretaker = CaretakerInfoSerializer(read_only=True)
    student_id = serializers.IntegerField(write_only=True, required=False)
    caretaker_id = serializers.IntegerField(write_only=True, required=False)
    feedback = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id', 'appointment_request', 'caretaker', 'caretaker_id', 
            'student', 'student_id', 'start', 'end', 'duration_minutes', 
            'status', 'conference_link', 'meet_link', 'feedback'
        ]

    def get_feedback(self, obj):
        feedback = getattr(obj, "feedback", None)
        if not feedback or feedback.status != AppointmentFeedback.STATUS_SUBMITTED:
            return None
        return AppointmentFeedbackSerializer(feedback).data


class SlotSerializer(serializers.Serializer):
    start = serializers.CharField()
    end = serializers.CharField()
    time = serializers.CharField()
    is_available = serializers.BooleanField()
