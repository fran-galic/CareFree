from dataclasses import dataclass


@dataclass(frozen=True)
class CategoryNode:
    code: str
    label: str
    children: tuple["CategoryNode", ...] = ()


CATEGORY_TREE: tuple[CategoryNode, ...] = (
    CategoryNode(
        "1",
        "Stres i akademski pritisci",
        (
            CategoryNode("1.1", "Strah od ispita i loših ocjena"),
            CategoryNode("1.2", "Preopterećenost obavezama"),
            CategoryNode("1.3", "Problemi s organizacijom vremena i prokrastinacija"),
        ),
    ),
    CategoryNode(
        "2",
        "Anksiozni poremećaji",
        (
            CategoryNode("2.1", "Generalizirani anksiozni poremećaj"),
            CategoryNode("2.2", "Socijalna anksioznost (strah od javnog nastupa, kontakta s profesorima/vršnjacima)"),
            CategoryNode("2.3", "Panični napadi"),
        ),
    ),
    CategoryNode(
        "3",
        "Depresivni simptomi",
        (
            CategoryNode("3.1", "Tuga, gubitak interesa za aktivnosti"),
            CategoryNode("3.2", "Umor i demotivacija"),
            CategoryNode("3.3", "Nisko samopouzdanje i osjećaj bespomoćnosti"),
        ),
    ),
    CategoryNode(
        "4",
        "Problemi u međuljudskim odnosima",
        (
            CategoryNode("4.1", "Sukobi s kolegama, prijateljima ili partnerima"),
            CategoryNode("4.2", "Problemi s komunikacijom i asertivnošću"),
            CategoryNode("4.3", "Osjećaj izolacije i usamljenosti"),
        ),
    ),
    CategoryNode(
        "5",
        "Poremećaji spavanja",
        (
            CategoryNode("5.1", "Nesanicu ili nepravilne navike spavanja"),
            CategoryNode("5.2", "Posljedice kroničnog umora na koncentraciju i raspoloženje"),
        ),
    ),
    CategoryNode(
        "6",
        "Problemi samopouzdanja i identiteta",
        (
            CategoryNode("6.1", "Sumnja u vlastite sposobnosti"),
            CategoryNode("6.2", "Nesigurnost u odabir studija ili karijere"),
            CategoryNode("6.3", "Osobni razvoj i pronalazak smisla"),
        ),
    ),
    CategoryNode(
        "7",
        "Poremećaji prehrane i tjelesne slike",
        (
            CategoryNode("7.1", "Anoreksija"),
            CategoryNode("7.2", "Bulimija"),
            CategoryNode("7.3", "Prejedanje"),
            CategoryNode("7.4", "Negativna tjelesna slika i poremećena percepcija sebe"),
        ),
    ),
    CategoryNode(
        "8",
        "Emocionalna regulacija i impulzivno ponašanje",
        (
            CategoryNode("8.1", "Nagli ispadi bijesa ili frustracije"),
            CategoryNode("8.2", "Problemi s kontrolom impulsa"),
            CategoryNode("8.3", "Ovisničko ponašanje (društvene mreže, kockanje, alkohol)"),
        ),
    ),
    CategoryNode(
        "9",
        "Trauma i stresne životne situacije",
        (
            CategoryNode("9.1", "Gubitak bliske osobe"),
            CategoryNode("9.2", "Obiteljski problemi ili zlostavljanje"),
            CategoryNode("9.3", "Adaptacija na novi životni period (selidba, fakultet u drugom gradu)"),
        ),
    ),
    CategoryNode(
        "10",
        "Seksualnost",
        (
            CategoryNode("10.1", "Propitivanje vlastite seksualnosti"),
            CategoryNode("10.2", "Anksioznost vezana za stupanje u spolne odnose"),
        ),
    ),
    CategoryNode("11", "KRIZNE SITUACIJE (RIZIK)"),
    CategoryNode("12", "OSTALO"),
)


def flatten_category_tree() -> list[CategoryNode]:
    flattened: list[CategoryNode] = []
    for root in CATEGORY_TREE:
        flattened.append(root)
        flattened.extend(root.children)
    return flattened


def category_listing_for_prompt() -> str:
    lines: list[str] = []
    for root in CATEGORY_TREE:
        lines.append(f"- {root.code} = {root.label}")
        for child in root.children:
            lines.append(f"  - {child.code} = {child.label}")
    return "\n".join(lines)


def _normalize(value: str) -> str:
    return (value or "").strip().casefold()


def code_to_label_map() -> dict[str, str]:
    return {node.code: node.label for node in flatten_category_tree()}


def label_to_code_map() -> dict[str, str]:
    return {_normalize(node.label): node.code for node in flatten_category_tree()}


def child_codes_for_main(main_code: str) -> list[str]:
    for root in CATEGORY_TREE:
        if root.code == main_code:
            return [child.code for child in root.children]
    return []


def parent_code_for_subcategory(subcategory_code: str) -> str:
    for root in CATEGORY_TREE:
        if any(child.code == subcategory_code for child in root.children):
            return root.code
    return ""


def resolve_category_selection(
    *,
    main_category_code: str = "",
    subcategory_codes: list[str] | None = None,
    main_category_label: str = "",
    subcategory_labels: list[str] | None = None,
) -> tuple[str, list[str], str, list[str]]:
    subcategory_codes = subcategory_codes or []
    subcategory_labels = subcategory_labels or []

    codes_by_label = label_to_code_map()
    labels_by_code = code_to_label_map()

    resolved_main_code = (main_category_code or "").strip()
    resolved_subcategory_codes = [code.strip() for code in subcategory_codes if code and code.strip() in labels_by_code]

    if not resolved_main_code and main_category_label:
        resolved_main_code = codes_by_label.get(_normalize(main_category_label), "")

    if not resolved_subcategory_codes and subcategory_labels:
        resolved_subcategory_codes = [
            codes_by_label[_normalize(label)]
            for label in subcategory_labels
            if _normalize(label) in codes_by_label
        ]

    if not resolved_main_code and resolved_subcategory_codes:
        resolved_main_code = parent_code_for_subcategory(resolved_subcategory_codes[0])

    resolved_main_label = labels_by_code.get(resolved_main_code, "")
    resolved_subcategory_labels = [labels_by_code[code] for code in resolved_subcategory_codes if code in labels_by_code]
    return resolved_main_code, resolved_subcategory_codes, resolved_main_label, resolved_subcategory_labels
