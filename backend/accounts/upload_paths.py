import os


def _ext_from_name(filename: str) -> str:
    parts = filename.rsplit('.', 1)
    return parts[1] if len(parts) == 2 else ''


def caretaker_image_upload_to(instance, filename):
    """Upload path for caretaker profile image: profile-images/image_{userid}.{ext}"""
    ext = _ext_from_name(filename)
    try:
        uid = instance.user.id
    except Exception:
        uid = getattr(instance, 'pk', None) or 'unknown'

    name = f"image_{uid}.{ext}" if ext else f"image_{uid}"
    return os.path.join('profile-images', name)


def cv_upload_to(instance, filename):
    """Upload path for CVs: documents/cv/cv_{userid}.{ext}"""
    ext = _ext_from_name(filename)
    try:
        uid = instance.caretaker.user.id
    except Exception:
        uid = getattr(instance.caretaker, 'pk', None) or 'unknown'

    name = f"cv_{uid}.{ext}" if ext else f"cv_{uid}"
    return os.path.join('documents', 'cv', name)


def diploma_upload_to(instance, filename):
    """Upload path for diplomas: documents/diploma/diploma_{number}_{userid}.{ext}

    Number is computed as current count + 1 to approximate ordinal. This
    may collide if diplomas are deleted, but provides a readable filename.
    """
    ext = _ext_from_name(filename)
    try:
        uid = instance.caretaker.user.id
    except Exception:
        uid = getattr(instance.caretaker, 'pk', None) or 'unknown'

    # compute ordinal
    try:
        current_count = instance.caretaker.diplomas.count()
    except Exception:
        current_count = 0

    number = current_count + 1
    name = f"diploma_{number}_{uid}.{ext}" if ext else f"diploma_{number}_{uid}"
    return os.path.join('documents', 'diploma', name)
