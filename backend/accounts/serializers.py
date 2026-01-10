from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from accounts.models import Caretaker, Student
from accounts.models import CaretakerCV, Diploma

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "sex", "age", "username", "role"]
        read_only_fields = ["id", "email"]


class LoginSerializer(serializers.ModelSerializer):
    email=serializers.EmailField()
    password=serializers.CharField(write_only=True)

    class Meta:
        model=User
        fields=["id", "email", "password"]
        extra_kwargs={"password": {"write_only": True}}


class EmailOnlySerializer(serializers.Serializer):
    email = serializers.EmailField()


class RegistrationConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(choices=(('student', 'student'), ('caretaker', 'caretaker')))
    password = serializers.CharField(write_only=True, min_length=6)



class CaretakerCVSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)

    class Meta:
        model = CaretakerCV
        fields = ['id', 'file', 'original_filename', 'mime_type', 'uploaded_at']
        read_only_fields = ['id', 'original_filename', 'mime_type', 'uploaded_at']

    def create(self, validated_data):
        uploaded = validated_data.get('file')
        caretaker = self.context.get('caretaker')
        if not caretaker:
            raise serializers.ValidationError('Caretaker context required')

        # replace existing CV if present
        obj, created = CaretakerCV.objects.update_or_create(
            caretaker=caretaker,
            defaults={
                'file': uploaded,
                'original_filename': getattr(uploaded, 'name', ''),
                'mime_type': getattr(uploaded, 'content_type', ''),
            }
        )
        return obj


class DiplomaSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)

    class Meta:
        model = Diploma
        fields = ['id', 'file', 'diploma_type', 'original_filename', 'mime_type', 'uploaded_at']
        read_only_fields = ['id', 'original_filename', 'mime_type', 'uploaded_at']

    def create(self, validated_data):
        uploaded = validated_data.pop('file')
        caretaker = self.context.get('caretaker')
        if not caretaker:
            raise serializers.ValidationError('Caretaker context required')

        obj = Diploma.objects.create(
            caretaker=caretaker,
            file=uploaded,
            original_filename=getattr(uploaded, 'name', ''),
            mime_type=getattr(uploaded, 'content_type', ''),
            **validated_data,
        )
        return obj


class CaretakerProfileSerializer(serializers.ModelSerializer):
    help_categories = serializers.PrimaryKeyRelatedField(many=True, queryset=Caretaker.help_categories.field.related_model.objects.all(), required=False)

    class Meta:
        model = Caretaker
        fields = ['about_me', 'tel_num', 'image_url', 'grad_year', 'help_categories', 'is_profile_complete', 'is_approved', 'approval_status']
        read_only_fields = ['is_profile_complete', 'is_approved', 'approval_status']
