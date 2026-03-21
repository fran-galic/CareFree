import random

from accounts.models import Caretaker, HelpCategory
from users.serializers import CaretakerLongSerializer

from .category_codes import child_codes_for_main, resolve_category_selection


def find_recommended_caretakers(
    main_category: str,
    subcategories: list[str],
    *,
    main_category_code: str = "",
    subcategory_codes: list[str] | None = None,
    request=None,
    limit: int = 12,
):
    base_queryset = Caretaker.objects.filter(is_approved=True).distinct()
    match_scope = "general"

    (
        resolved_main_category_code,
        resolved_subcategory_codes,
        resolved_main_category,
        resolved_subcategories,
    ) = _resolve_requested_categories(
        main_category_code=main_category_code,
        subcategory_codes=subcategory_codes or [],
        main_category=main_category,
        subcategories=subcategories,
    )

    subcategory_matches = []
    if resolved_subcategory_codes:
        subcategory_matches = list(
            base_queryset.filter(help_categories__assistant_code__in=resolved_subcategory_codes).distinct()[:50]
        )

    subcategory_ids = {caretaker.pk for caretaker in subcategory_matches}

    category_matches = []
    if resolved_main_category_code:
        category_related_codes = _category_related_codes(resolved_main_category_code)
        category_matches = list(
            base_queryset.filter(help_categories__assistant_code__in=category_related_codes).exclude(pk__in=subcategory_ids).distinct()[:50]
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
            subcategory_codes=resolved_subcategory_codes,
            main_category_code=resolved_main_category_code,
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


def _serialize_caretaker(caretaker: Caretaker, subcategory_codes: list[str], main_category_code: str, request=None):
    data = CaretakerLongSerializer(caretaker, context={"request": request}).data
    category_pairs = list(caretaker.help_categories.values_list("assistant_code", "label"))

    relevant_categories = [label for code, label in category_pairs if code in subcategory_codes]
    if not relevant_categories and main_category_code:
        related_codes = set(_category_related_codes(main_category_code))
        relevant_categories = [label for code, label in category_pairs if code in related_codes]
    if not relevant_categories:
        relevant_categories = [label for _, label in category_pairs[:2]]

    data["assistant_relevant_categories"] = relevant_categories[:2]
    return data


def _normalize_label(value: str) -> str:
    return (value or "").strip().casefold()


def _resolve_requested_categories(
    *,
    main_category_code: str,
    subcategory_codes: list[str],
    main_category: str,
    subcategories: list[str],
) -> tuple[str, list[str], str, list[str]]:
    resolved_main_category_code, resolved_subcategory_codes, resolved_main_category, resolved_subcategories = resolve_category_selection(
        main_category_code=main_category_code,
        subcategory_codes=subcategory_codes,
        main_category_label=main_category,
        subcategory_labels=subcategories,
    )

    if not resolved_main_category_code and main_category:
        by_label = {
            _normalize_label(category.label): category
            for category in HelpCategory.objects.select_related("parent").all()
        }
        resolved_main = by_label.get(_normalize_label(main_category))
        if resolved_main and resolved_main.assistant_code:
            resolved_main_category_code = resolved_main.assistant_code
            resolved_main_category = resolved_main.label

    if not resolved_subcategory_codes and subcategories:
        by_label = {
            _normalize_label(category.label): category
            for category in HelpCategory.objects.select_related("parent").all()
        }
        resolved_subcategories_db = [by_label[_normalize_label(label)] for label in subcategories if _normalize_label(label) in by_label]
        resolved_subcategory_codes = [category.assistant_code for category in resolved_subcategories_db if category.assistant_code]
        resolved_subcategories = [category.label for category in resolved_subcategories_db]
        if not resolved_main_category_code and resolved_subcategories_db and resolved_subcategories_db[0].parent:
            resolved_main_category_code = resolved_subcategories_db[0].parent.assistant_code or ""
            resolved_main_category = resolved_subcategories_db[0].parent.label

    return resolved_main_category_code, resolved_subcategory_codes, resolved_main_category, resolved_subcategories


def _category_related_codes(main_category_code: str) -> list[str]:
    if not main_category_code:
        return []
    return [main_category_code, *child_codes_for_main(main_category_code)]
