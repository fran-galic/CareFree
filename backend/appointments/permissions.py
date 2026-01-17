from rest_framework import permissions


class IsStudent(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'student' or hasattr(user, 'student'))


class IsCaretaker(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'caretaker' or hasattr(user, 'caretaker'))


class IsOwnerOrCaretaker(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if hasattr(user, 'student') and getattr(obj, 'student', None) == user.student:
            return True
        caretaker = getattr(user, 'caretaker', None)
        if caretaker is not None:
            target = getattr(obj, 'caretaker', None) or getattr(obj, 'psychologist', None)
            return target == caretaker
        return False


class OnlyCaretakerCanApprove(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        caretaker = getattr(user, 'caretaker', None)
        return caretaker is not None and getattr(obj, 'caretaker', None) == caretaker
