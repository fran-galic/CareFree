import random

from accounts.models import Caretaker, HelpCategory
from users.serializers import CaretakerLongSerializer


def find_recommended_caretakers(main_category: str, subcategories: list[str], request=None, limit: int = 12):
    base_queryset = Caretaker.objects.filter(is_approved=True).distinct()
    match_scope = "general"

    resolved_main_category, resolved_subcategories = _resolve_requested_categories(
        main_category=main_category,
        subcategories=subcategories,
    )

    subcategory_matches = []
    if resolved_subcategories:
        subcategory_matches = list(
            base_queryset.filter(help_categories__label__in=resolved_subcategories).distinct()[:50]
        )

    subcategory_ids = {caretaker.pk for caretaker in subcategory_matches}

    category_matches = []
    if resolved_main_category:
        category_matches = list(
            base_queryset.filter(help_categories__label=resolved_main_category).exclude(pk__in=subcategory_ids).distinct()[:50]
        )

    category_ids = {caretaker.pk for caretaker in category_matches}

    general_matches = list(
        base_queryset.exclude(pk__in=subcategory_ids | category_ids).distinct()[:50]
    )

    if subcategory_matches:
        match_scope = "subcategory"
    elif category_matches:
        match_scope = "category"

    random.shuffle(subcategory_matches)
    random.shuffle(category_matches)
    random.shuffle(general_matches)

    caretakers = (subcategory_matches + category_matches + general_matches)[:limit]
    serialized = [
        _serialize_caretaker(
            caretaker,
            subcategories=resolved_subcategories,
            main_category=resolved_main_category,
            request=request,
        )
        for caretaker in caretakers
    ]
    caretaker_ids = [caretaker.pk for caretaker in caretakers]
    return caretaker_ids, serialized, match_scope


def build_recommendation_summary_text(summary_text: str, main_category: str, subcategories: list[str], match_scope: str) -> str:
    if summary_text.strip():
        return summary_text.strip()

    if match_scope == "subcategory" and subcategories:
        joined = ", ".join(subcategories[:2])
        return (
            f"Iz razgovora se vidi da te najviše opterećuju teme povezane s ovim područjima: {joined}. "
            "Zato su izdvojeni psiholozi koji rade upravo s takvim teškoćama."
        )

    if match_scope == "category" and main_category:
        return (
            f"Iz razgovora se vidi da te najviše opterećuju teme povezane s kategorijom „{main_category}”. "
            "Zato su izdvojeni psiholozi koji rade s takvim vrstama poteškoća."
        )

    return (
        "Iz razgovora se vidi da ti je dobrodošao razgovor sa stručnom osobom. "
        "Zato je izdvojen širi krug dostupnih psihologa koje možeš mirno pregledati."
    )


def _serialize_caretaker(caretaker: Caretaker, subcategories: list[str], main_category: str, request=None):
    data = CaretakerLongSerializer(caretaker, context={"request": request}).data
    help_categories = data.get("help_categories", [])

    relevant_categories = [label for label in help_categories if label in subcategories]
    if not relevant_categories and main_category and main_category in help_categories:
        relevant_categories = [main_category]
    if not relevant_categories:
        relevant_categories = help_categories[:2]

    data["assistant_relevant_categories"] = relevant_categories[:2]
    return data


def _normalize_label(value: str) -> str:
    return (value or "").strip().casefold()


def _resolve_requested_categories(main_category: str, subcategories: list[str]) -> tuple[str, list[str]]:
    normalized_map = {
        _normalize_label(category.label): category
        for category in HelpCategory.objects.select_related("parent").all()
    }

    resolved_subcategories: list[HelpCategory] = []
    for label in subcategories:
        category = normalized_map.get(_normalize_label(label))
        if category is not None:
            resolved_subcategories.append(category)

    resolved_main = normalized_map.get(_normalize_label(main_category)) if main_category else None

    if resolved_main is None and resolved_subcategories:
        parent = resolved_subcategories[0].parent
        if parent is not None:
            resolved_main = parent

    resolved_subcategory_labels = [category.label for category in resolved_subcategories]
    resolved_main_label = resolved_main.label if resolved_main is not None else ""
    return resolved_main_label, resolved_subcategory_labels
