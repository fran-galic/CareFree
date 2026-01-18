from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.models import Caretaker, Student, CaretakerCV, Diploma, Certificate
from .validators import validate_caretaker_image, validate_file_type_and_size
from django.core.exceptions import ValidationError as DjangoValidationError

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
        # validate file (type and size)
        try:
            validate_file_type_and_size(uploaded)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'file': e.messages})
        except Exception as e:
            raise serializers.ValidationError({'file': str(e)})

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
        fields = ['id', 'file', 'original_filename', 'mime_type', 'uploaded_at']
        read_only_fields = ['id', 'original_filename', 'mime_type', 'uploaded_at']

    def create(self, validated_data):
        uploaded = validated_data.pop('file')
        caretaker = self.context.get('caretaker')
        if not caretaker:
            raise serializers.ValidationError('Caretaker context required')

        # validate file (type and size)
        try:
            validate_file_type_and_size(uploaded)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'file': e.messages})
        except Exception as e:
            raise serializers.ValidationError({'file': str(e)})

        obj = Diploma.objects.create(
            caretaker=caretaker,
            file=uploaded,
            original_filename=getattr(uploaded, 'name', ''),
            mime_type=getattr(uploaded, 'content_type', ''),
            **validated_data,
        )
        return obj


class CertificateSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)

    class Meta:
        model = Certificate
        fields = ['id', 'file', 'original_filename', 'mime_type', 'uploaded_at']
        read_only_fields = ['id', 'original_filename', 'mime_type', 'uploaded_at']

    def create(self, validated_data):
        uploaded = validated_data.pop('file')
        caretaker = self.context.get('caretaker')
        if not caretaker:
            raise serializers.ValidationError('Caretaker context required')

        # validate file (type and size)
        try:
            validate_file_type_and_size(uploaded)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'file': e.messages})
        except Exception as e:
            raise serializers.ValidationError({'file': str(e)})

        obj = Certificate.objects.create(
            caretaker=caretaker,
            file=uploaded,
            original_filename=getattr(uploaded, 'name', ''),
            mime_type=getattr(uploaded, 'content_type', ''),
            **validated_data,
        )
        return obj


class CaretakerProfileSerializer(serializers.ModelSerializer):
    help_categories = serializers.PrimaryKeyRelatedField(many=True, queryset=Caretaker.help_categories.field.related_model.objects.all(), required=False)
    # image = serializers.ImageField(required=False, allow_null=True)
    # image_mime_type = serializers.CharField(read_only=True)

    class Meta:
        model = Caretaker
        fields = ['about_me', 'tel_num', 'grad_year', 'help_categories', 'is_profile_complete', 'is_approved', 'approval_status']
        read_only_fields = ['is_profile_complete', 'is_approved', 'approval_status', 'image_mime_type']


class CaretakerSearchSerializer(serializers.ModelSerializer):
    """Serializer for caretaker search results"""
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = Caretaker
        fields = ['user_id', 'first_name', 'last_name', 'email', 'about_me', 'grad_year', 'is_approved']
        read_only_fields = fields


class CaretakerImageSerializer(serializers.Serializer):
    image = serializers.FileField(write_only=True)

    def validate_image(self, value):
        # file extension and size validator
        try:
            validate_caretaker_image(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'image': e.messages})
        except Exception as e:
            raise serializers.ValidationError({'image': str(e)})

        # verify image content using Pillow
        try:
            from PIL import Image, UnidentifiedImageError
            # Image.open may consume the file pointer; ensure seek(0) afterwards
            img = Image.open(value)
            img.verify()
            try:
                value.seek(0)
            except Exception:
                pass
        except UnidentifiedImageError:
            raise serializers.ValidationError({'image': 'Upload a valid image. The file you uploaded was either not an image or a corrupted image.'})
        except Exception as e:
            raise serializers.ValidationError({'image': str(e)})

        return value

    def create(self, validated_data):
        uploaded = validated_data.get('image')
        caretaker = self.context.get('caretaker')
        if not caretaker:
            raise serializers.ValidationError('Caretaker context required')

        # assign and save; model's save() will try to populate mime type
        caretaker.image = uploaded
        try:
            content_type = getattr(uploaded, 'content_type', None)
            if content_type:
                caretaker.image_mime_type = content_type
        except Exception:
            pass

        caretaker.save()
        return caretaker
