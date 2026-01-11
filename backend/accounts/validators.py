from django.core.exceptions import ValidationError

ALLOWED_EXTENSIONS = ('.pdf', '.jpg', '.jpeg')
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def validate_file_type_and_size(value):
    """Validate uploaded file is PDF/JPG/JPEG and <= MAX_FILE_SIZE."""
    # value is a FieldFile or UploadedFile
    name = getattr(value, 'name', '')
    size = getattr(value, 'size', None)

    # extension check
    if name:
        lower = name.lower()
        if not any(lower.endswith(ext) for ext in ALLOWED_EXTENSIONS):
            raise ValidationError('Unsupported file extension. Allowed: PDF, JPG, JPEG.')

    # size check
    if size is not None:
        try:
            size_int = int(size)
        except Exception:
            size_int = None
        if size_int is not None and size_int > MAX_FILE_SIZE:
            raise ValidationError(f'File too large. Maximum size is {MAX_FILE_SIZE} bytes.')

    # Optionally, more robust MIME checks could be added here.


ALLOWED_IMAGE_EXTENSIONS = ('.jpg', '.jpeg')


def validate_caretaker_image(value):
    """Validate caretaker profile image: only JPG/JPEG and <= MAX_FILE_SIZE."""
    name = getattr(value, 'name', '')
    size = getattr(value, 'size', None)

    if name:
        lower = name.lower()
        if not any(lower.endswith(ext) for ext in ALLOWED_IMAGE_EXTENSIONS):
            raise ValidationError('Unsupported image extension. Allowed: JPG, JPEG.')

    if size is not None:
        try:
            size_int = int(size)
        except Exception:
            size_int = None
        if size_int is not None and size_int > MAX_FILE_SIZE:
            raise ValidationError(f'Image too large. Maximum size is {MAX_FILE_SIZE} bytes.')

