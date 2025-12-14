from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from accounts.models import Caretaker, Student

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "sex", "age", "username", "role"]
        read_only_fields = ["id", "email"]

    

# class RegisterSerializer(serializers.ModelSerializer):
#     password = serializers.CharField(write_only=True, required=True, min_length=6)
#     email = serializers.EmailField(required=True, validators=[
#         UniqueValidator(queryset=User.objects.all(), message="Korisnik s ovim email-om već postoji")
#     ])

#     def validate_email(self, value):
#         return value.strip().lower()

#     class Meta:
#         model=User
#         fields=["id", "first_name", "last_name", "email", "username", "password", "sex", "age", "role"]
#         extra_kwargs = {"password": {"write_only": True}}

#     def create(self, validated_data):
#         user = User.objects.create_user(
#             email=validated_data.pop('email'),
#             # username=validated_data.pop('username'), necemo koristit username nepotreban je
#             password=validated_data.pop('password'),
#             sex=validated_data.pop('sex'),
#             age=validated_data.pop('age'),
#             role=validated_data.pop('role'),
#         )
#         return user


    

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
