from django.db.models.signals import post_save, pre_delete, pre_save
from django.db.models.signals import post_delete, m2m_changed
from django.dispatch import receiver
from django.conf import settings

from django.contrib.auth import get_user_model
from .models import Caretaker, CaretakerCV, Diploma, Certificate

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


# File deletion handlers for cloud storage cleanup

@receiver(pre_save, sender=Caretaker)
def delete_old_caretaker_image_on_update(sender, instance, **kwargs):
    """Delete old profile image from storage when a new one is uploaded."""
    if not instance.pk:
        # New instance, no old image to delete
        return
    
    try:
        old_instance = Caretaker.objects.filter(pk=instance.pk).first()
        if not old_instance:
            return
        
        old_image = old_instance.image
        new_image = instance.image
        
        # Check if image has changed
        if old_image and old_image != new_image:
            # Delete the old image file from storage
            old_image.delete(save=False)
    except Exception:
        # Don't fail save if old file deletion fails
        pass


@receiver(pre_save, sender=CaretakerCV)
def delete_old_cv_on_update(sender, instance, **kwargs):
    """Delete old CV file from storage when a new one is uploaded."""
    if not instance.pk:
        # New instance, no old file to delete
        return
    
    try:
        old_instance = CaretakerCV.objects.filter(pk=instance.pk).first()
        if not old_instance:
            return
        
        old_file = old_instance.file
        new_file = instance.file
        
        # Check if file has changed
        if old_file and old_file != new_file:
            # Delete the old file from storage
            old_file.delete(save=False)
    except Exception:
        # Don't fail save if old file deletion fails
        pass


@receiver(pre_delete, sender=Caretaker)
def delete_caretaker_image(sender, instance, **kwargs):
    """Delete caretaker profile image from storage when caretaker is deleted."""
    try:
        if instance.image:
            # Delete the file from storage (local or cloud)
            instance.image.delete(save=False)
    except Exception:
        # Don't fail deletion if file removal fails
        pass


@receiver(pre_delete, sender=Caretaker)
def delete_caretaker_user(sender, instance, **kwargs):
    """Delete related User when Caretaker is deleted."""
    try:
        if instance.user:
            instance.user.delete()
    except Exception:
        # Don't fail deletion if user removal fails
        pass


@receiver(pre_delete, sender=CaretakerCV)
def delete_cv_file(sender, instance, **kwargs):
    """Delete CV file from storage when CaretakerCV is deleted."""
    try:
        if instance.file:
            instance.file.delete(save=False)
    except Exception:
        pass


@receiver(pre_delete, sender=Diploma)
def delete_diploma_file(sender, instance, **kwargs):
    """Delete diploma file from storage when Diploma is deleted."""
    try:
        if instance.file:
            instance.file.delete(save=False)
    except Exception:
        pass


@receiver(pre_delete, sender=Certificate)
def delete_certificate_file(sender, instance, **kwargs):
    """Delete certificate file from storage when Certificate is deleted."""
    try:
        if instance.file:
            instance.file.delete(save=False)
    except Exception:
        pass
