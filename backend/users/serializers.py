from rest_framework import serializers
from django.contrib.auth import get_user_model
from accounts.models import Caretaker
from accounts.serializers import UserSerializer as BaseUserSerializer
from accounts.models import Student

User = get_user_model()


class CaretakerShortSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    help_categories = serializers.SlugRelatedField(many=True, read_only=True, slug_field='label')
    image = serializers.SerializerMethodField()

    class Meta:
        model = Caretaker
        fields = ["user_id", "first_name", "last_name", "help_categories", "image", "grad_year"]

    def get_image(self, obj):
        if obj.image:
            try:
                return obj.image.url
            except Exception:
                return None
        return None

class CaretakerLongSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    help_categories = serializers.SlugRelatedField(many=True, read_only=True, slug_field='label')
    image = serializers.SerializerMethodField()

    class Meta:
        model = Caretaker
        fields = ["user_id", "first_name", "last_name", "help_categories", "image", "about_me", "grad_year"]

    def get_image(self, obj):
        if obj.image:
            try:
                return obj.image.url
            except Exception:
                return None
        return None


class MeSerializer(BaseUserSerializer):

    caretaker = CaretakerShortSerializer(read_only=True)
    student = serializers.SerializerMethodField()

    class Meta(BaseUserSerializer.Meta):
        model = User
        fields = BaseUserSerializer.Meta.fields + ["caretaker", "student"]
        read_only_fields = BaseUserSerializer.Meta.read_only_fields

    def get_student(self, obj):
        try:
            from accounts.serializers import StudentSerializer as _StudentSerializer
        except Exception:
            return None

        try:
            student = obj.student
        except Exception:
            return None

        return _StudentSerializer(student).data


class UpdateUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username", "sex", "age"]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True, min_length=6)
    new_password2 = serializers.CharField(write_only=True, required=True, min_length=6)

    def validate(self, attrs):
        if attrs.get("new_password") != attrs.get("new_password2"):
            raise serializers.ValidationError({"new_password2": "Lozinke se ne podudaraju."})
        return attrs


class CaretakerUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Caretaker
        fields = ["about_me", "tel_num"]


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ["user_id", "studying_at", "year_of_study"]


class StudentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ["studying_at", "year_of_study"]


from accounts.models import HelpCategory


class SubCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = HelpCategory
        fields = ("id", "label", "slug")


class CategoryWithSubcategoriesSerializer(serializers.ModelSerializer):
    subcategories = SubCategorySerializer(many=True, read_only=True)

    class Meta:
        model = HelpCategory
        fields = ("id", "label", "slug", "subcategories")


