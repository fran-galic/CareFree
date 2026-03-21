import random

from accounts.models import Caretaker
from users.serializers import CaretakerLongSerializer


def find_recommended_caretakers(main_category: str, subcategories: list[str], request=None, limit: int = 12):
    base_queryset = Caretaker.objects.filter(is_approved=True).distinct()
    queryset = base_queryset

    if main_category:
        queryset = queryset.filter(help_categories__label=main_category).distinct()
    elif subcategories:
        queryset = queryset.filter(help_categories__label__in=subcategories).distinct()

    caretakers = list(queryset[:50])
    used_general_fallback = False
    if not caretakers:
        caretakers = list(base_queryset[:50])
        used_general_fallback = True

    random.shuffle(caretakers)
    caretakers = caretakers[:limit]
    serialized = [
        CaretakerLongSerializer(caretaker, context={"request": request}).data
        for caretaker in caretakers
    ]
    caretaker_ids = [caretaker.pk for caretaker in caretakers]
    return caretaker_ids, serialized, used_general_fallback
