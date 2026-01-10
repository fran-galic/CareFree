from rest_framework.permissions import BasePermission


class IsStudent(BasePermission):
    """Allow access only to authenticated users with role 'student'."""

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'student')


class IsCaretaker(BasePermission):
    """Allow access only to authenticated users with role 'student'."""

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'caretaker')


class IsApprovedCaretaker(BasePermission):
    """Allow access only to caretakers who completed registration and are approved.

    Uses `is_profile_complete` and `is_approved` boolean flags on the `Caretaker` model.
    """

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated and getattr(user, 'role', None) == 'caretaker'):
            return False
        caretaker = getattr(user, 'caretaker', None)
        if not caretaker:
            return False
        return bool(getattr(caretaker, 'is_approved', False))
