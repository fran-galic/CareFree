from django.db.models.signals import post_save
from django.db.models.signals import post_delete, m2m_changed
from django.dispatch import receiver
from django.conf import settings

from django.contrib.auth import get_user_model
from .models import Caretaker, CaretakerCV, Diploma

User = get_user_model()


# @receiver(post_save, sender=User)
# def create_role_profile(sender, instance, created, **kwargs):
#     if not created:
#         return
#     # if a caretaker user was created, ensure a Caretaker profile exists
#     try:
#         if getattr(instance, 'role', None) == 'caretaker':
#             Caretaker.objects.create(user=instance)
#     except Exception:
#         # don't raise during user creation
#         pass


@receiver(post_save, sender=Caretaker)
def sync_caretaker_approval(sender, instance, created, **kwargs):
    """Keep `is_approved` boolean in sync with `approval_status`.

    Uses `QuerySet.update()` to avoid calling `save()` and retriggering signals.
    """
    try:
        status = getattr(instance, 'approval_status', None)
        # compare against model constant for approved status
        try:
            approved_const = getattr(instance, 'APPROVAL_APPROVED')
        except Exception:
            approved_const = 'APPROVED'
        is_approved_value = True if status == approved_const else False
        if instance.is_approved != is_approved_value:
            Caretaker.objects.filter(pk=instance.pk).update(is_approved=is_approved_value)
    except Exception:
        # avoid raising from signal handlers
        pass


def evaluate_profile_complete(caretaker_pk):
    """Evaluate required fields for a caretaker and update `is_profile_complete`.

    This function queries related models to ensure up-to-date state
    (handles m2m and related model changes).
    """
    try:
        ct = Caretaker.objects.filter(pk=caretaker_pk).first()
        if not ct:
            return
        
        # Use model helper to determine completeness (centralized logic)
        try:
            required = bool(ct.is_complete())
        except Exception:
            required = False

        if ct.is_profile_complete != required:
            Caretaker.objects.filter(pk=caretaker_pk).update(is_profile_complete=required)
    except Exception:
        pass


@receiver(post_save, sender=Caretaker)
def caretaker_post_save_update_completeness(sender, instance, created, **kwargs):
    # evaluate when caretaker fields change
    try:
        evaluate_profile_complete(instance.pk)
    except Exception:
        pass


@receiver(m2m_changed, sender=Caretaker.help_categories.through)
def caretaker_helpcategories_changed(sender, instance, action, **kwargs):
    # actions: 'post_add', 'post_remove', 'post_clear'
    if action in ('post_add', 'post_remove', 'post_clear'):
        try:
            evaluate_profile_complete(instance.pk)
        except Exception:
            pass


@receiver(post_save, sender=CaretakerCV)
def cv_changed_update_completeness(sender, instance, created, **kwargs):
    try:
        evaluate_profile_complete(instance.caretaker.pk)
    except Exception:
        pass


@receiver(post_save, sender=Diploma)
@receiver(post_delete, sender=Diploma)
def diploma_changed_update_completeness(sender, instance, **kwargs):
    try:
        evaluate_profile_complete(instance.caretaker.pk)
    except Exception:
        pass
