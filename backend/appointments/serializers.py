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


class AppointmentRequestSerializer(serializers.ModelSerializer):
    student = StudentInfoSerializer(read_only=True)
    caretaker = CaretakerInfoSerializer(read_only=True)
    student_id = serializers.IntegerField(write_only=True, required=False)
    caretaker_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = AppointmentRequest
        fields = [
            'id', 'student', 'student_id', 'caretaker', 'caretaker_id', 
            'requested_start', 'requested_end', 'message', 'ai_summary', 
            'status', 'created_at'
        ]
        read_only_fields = ['ai_summary', 'status', 'created_at']


class AppointmentSerializer(serializers.ModelSerializer):
    class AppointmentFeedbackSerializer(serializers.ModelSerializer):
        student = StudentInfoSerializer(read_only=True)

        class Meta:
            model = AppointmentFeedback
            fields = [
                'id', 'appointment', 'student', 'rating', 'comment',
                'is_public', 'created_at', 'updated_at'
            ]
            read_only_fields = ['id', 'appointment', 'student', 'created_at', 'updated_at']

    meet_link = serializers.CharField(source='conference_link', read_only=True)
    student = StudentInfoSerializer(read_only=True)
    caretaker = CaretakerInfoSerializer(read_only=True)
    feedback = AppointmentFeedbackSerializer(read_only=True)
    student_id = serializers.IntegerField(write_only=True, required=False)
    caretaker_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Appointment
        fields = [
            'id', 'appointment_request', 'caretaker', 'caretaker_id', 
            'student', 'student_id', 'start', 'end', 'duration_minutes', 
            'status', 'conference_link', 'meet_link', 'feedback'
        ]


class AppointmentFeedbackSerializer(serializers.ModelSerializer):
    student = StudentInfoSerializer(read_only=True)

    class Meta:
        model = AppointmentFeedback
        fields = [
            'id', 'appointment', 'student', 'rating', 'comment',
            'is_public', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'student', 'created_at', 'updated_at']


class SlotSerializer(serializers.Serializer):
    start = serializers.CharField()
    end = serializers.CharField()
    time = serializers.CharField()
    is_available = serializers.BooleanField()
