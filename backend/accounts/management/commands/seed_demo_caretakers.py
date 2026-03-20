from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from accounts.models import Caretaker, CaretakerCV, Certificate, Diploma, HelpCategory
from appointments.models import AvailabilitySlot


FEMALE_FIRST_NAMES = [
    "Ana", "Petra", "Iva", "Marija", "Katarina", "Lucija", "Ivana",
    "Matea", "Tea", "Nika", "Tena", "Dora", "Ema", "Sara", "Lea",
]

MALE_FIRST_NAMES = [
    "Filip", "Ivan", "Luka", "Marko", "Josip", "Karlo", "Matej", "Tin", "Domagoj", "Ante",
]

LAST_NAMES = [
    "Horvat", "Kovačević", "Babić", "Marić", "Perić", "Novak", "Božić", "Jurić",
    "Knežević", "Tomić", "Pavlović", "Milić", "Grgić", "Lovrić", "Blažević",
    "Rukavina", "Vuković", "Petrović", "Mlinarić", "Kralj", "Vidović", "Kovač", "Lukić",
]

ABOUT_ME_OPTIONS = [
    "U radu sa studentima nastojim ponuditi siguran, smiren i povjerljiv prostor u kojem je moguce otvoreno govoriti o onome sto opterecuje, bez pritiska i bez osjecaja da se sve mora odmah rijesiti.",
    "Vazno mi je da se student tijekom susreta osjeca saslusano i razumijeno. Razgovor vodim mirno i strukturirano, s fokusom na ono sto osobi u tom trenutku moze donijeti vise jasnoce, olaksanja i oslonca.",
    "U savjetovanju mi je cilj pomoci studentu da bolje razumije vlastite obrasce, emocije i izvore pritiska, te da kroz razgovor pronade odrziviji i sigurniji nacin nosenja s onim kroz sto prolazi.",
    "Pristupam radu profesionalno, toplo i nenametljivo. Posebno mi je vazno da susret ne ostane samo na razgovoru, nego da student iz njega ponese veci osjecaj stabilnosti, usmjerenja i povjerenja u vlastite kapacitete.",
    "Studentima nastojim pruziti prostor u kojem mogu stati, predahnuti i jasnije sagledati ono sto ih opterecuje. U radu njegujem strpljenje, postovanje i tempo koji je prilagoden osobi s kojom radim.",
    "Vjerujem da kvalitetan terapijski odnos pocinje osjecajem sigurnosti i prihvacenosti. Zato mi je vazno graditi suradnju u kojoj student moze iskreno govoriti o svojim brigama, dilemama i unutarnjem pritisku.",
    "U radu kombiniram razumijevanje, jasnu strukturu i prakticnu usmjerenost. Cilj mi je da student kroz susrete dobije vise unutarnje jasnoce, bolju emocionalnu regulaciju i osjecaj da nije sam u onome sto prozivljava.",
]

FOCUS_AREAS = [
    "anksioznost i panični simptomi",
    "stres, burnout i akademski pritisak",
    "samopouzdanje i perfekcionizam",
    "međuljudski odnosi i granice",
    "depresivni simptomi i gubitak motivacije",
    "emocionalna regulacija i impulzivnost",
    "problemi spavanja i kronični umor",
    "prilagodba na fakultet, selidbu i životne promjene",
    "tuga, gubitak i teške životne situacije",
    "organizacija vremena i prokrastinacija",
]

DEGREE_TITLES_BY_SEX = {
    "F": ["mag. psych.", "univ. mag. psych.", "magistra psihologije"],
    "M": ["mag. psych.", "univ. mag. psych.", "magistar psihologije"],
}

CERTIFICATE_NAMES = [
    "uvod u kognitivno-bihevioralne tehnike",
    "savjetovanje mladih odraslih osoba",
    "osnove kriznih intervencija",
    "emocionalna regulacija i rad sa stresom",
    "komunikacijske i relacijske vještine u savjetovanju",
]

SPECIAL_EXPERIENCE_YEARS = {
    "m_5.jpg": 17,
    "w_2.jpg": 15,
    "w_9.jpg": 18,
    "w_10.jpg": 16,
}

FALLBACK_PDF_BYTES = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 97 >>
stream
BT
/F1 18 Tf
72 760 Td
(CareFree Demo Dokument) Tj
0 -28 Td
/F1 11 Tf
(Automatski generirani placeholder za lokalni seed.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000248 00000 n 
0000000396 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
466
%%EOF
"""


class Command(BaseCommand):
    help = "Populate local DB with demo approved caretakers using images from demo_profiles."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=0, help="How many demo caretakers to create. Default: all available demo profile images.")
        parser.add_argument(
            "--password",
            default="DemoPsiholog123!",
            help="Password assigned to all generated demo users.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        base_dir = Path(__file__).resolve().parents[4]
        demo_dir = base_dir / "demo_profiles"
        if not demo_dir.exists():
            raise CommandError(f"Missing demo_profiles directory: {demo_dir}")

        image_paths = sorted(
            path for path in demo_dir.iterdir()
            if path.is_file()
            and path.suffix.lower() in {".jpg", ".jpeg", ".png"}
            and path.name.lower().startswith(("m_", "w_"))
        )
        if not image_paths:
            raise CommandError(f"No prefixed demo images found in {demo_dir}. Expected files like m_1.jpg or w_1.jpg.")

        image_paths = sorted(image_paths, key=self._image_sort_key)

        count = options["count"] or len(image_paths)
        if count <= 0:
            raise CommandError("Count must be greater than zero.")
        if count > len(image_paths):
            self.stdout.write(self.style.WARNING(
                f"Requested {count} demo caretakers, but only {len(image_paths)} images exist. Using all available images."
            ))
            count = len(image_paths)

        call_command("seed_help_categories")
        leaf_categories = list(HelpCategory.objects.filter(parent__isnull=False).order_by("id"))
        root_categories = list(HelpCategory.objects.filter(parent__isnull=True).order_by("id"))
        categories = leaf_categories or root_categories
        if not categories:
            raise CommandError("No HelpCategory records available even after seeding.")

        image_paths = image_paths[:count]
        pdf_path = demo_dir / "moguce_teme_za_projekt.pdf"
        pdf_bytes = pdf_path.read_bytes() if pdf_path.exists() else FALLBACK_PDF_BYTES
        User = get_user_model()
        tz = ZoneInfo("Europe/Zagreb")

        created = 0
        updated = 0
        generated_emails = []
        gender_counters = {"F": 0, "M": 0}

        for index, image_path in enumerate(image_paths, start=1):
            sex = self._sex_from_image_name(image_path.name)
            gender_counters[sex] += 1
            first_name = self._first_name_for_sex(sex, gender_counters[sex])
            last_name = LAST_NAMES[(index - 1) % len(LAST_NAMES)]
            experience_years = self._experience_years_for_image(image_path.name, index)
            current_year = timezone.now().year
            grad_year = current_year - experience_years
            age = max(31, min(58, experience_years + 24 + (index % 5)))
            username = f"demo-caretaker-{index:02d}-{slugify(first_name)}-{slugify(last_name)}"
            email = f"{slugify(first_name)}.{slugify(last_name)}.{index:02d}@demo.carefree.local"
            generated_emails.append(email)

            user, was_created = User.objects.update_or_create(
                email=email,
                defaults={
                    "username": username,
                    "first_name": first_name,
                    "last_name": last_name,
                    "age": age,
                    "sex": sex,
                    "role": "caretaker",
                },
            )
            user.set_password(options["password"])
            user.save(update_fields=["password"])

            if was_created:
                created += 1
            else:
                updated += 1

            focus = FOCUS_AREAS[(index - 1) % len(FOCUS_AREAS)]
            degree = DEGREE_TITLES_BY_SEX[sex][(index - 1) % len(DEGREE_TITLES_BY_SEX[sex])]
            about_me = self._build_about_me(index, sex, focus, grad_year)

            caretaker, _ = Caretaker.objects.get_or_create(user=user)
            caretaker.tel_num = self._build_phone(index)
            caretaker.about_me = about_me
            caretaker.grad_year = grad_year
            caretaker.show_email_to_students = index % 3 != 0
            caretaker.show_phone_to_students = index % 4 == 0
            caretaker.approval_status = Caretaker.APPROVAL_APPROVED

            caretaker.image.save(
                f"{username}{image_path.suffix.lower()}",
                ContentFile(image_path.read_bytes()),
                save=False,
            )
            caretaker.save()

            chosen_categories = self._choose_categories(categories, index)
            caretaker.help_categories.set(chosen_categories)

            self._replace_cv(caretaker, pdf_bytes, index)
            self._replace_diplomas(caretaker, pdf_bytes, degree, grad_year, index)
            self._replace_certificates(caretaker, pdf_bytes, index)
            self._replace_availability(caretaker, index, tz)

            caretaker.refresh_from_db()
            if not caretaker.is_profile_complete:
                caretaker.is_profile_complete = caretaker.is_complete()
                caretaker.save(update_fields=["is_profile_complete"])

            self.stdout.write(
                self.style.SUCCESS(
                    f"{'Created' if was_created else 'Updated'} demo caretaker {index:02d}: "
                    f"{first_name} {last_name} ({email}, {image_path.name})"
                )
            )

        stale_demo_users = User.objects.filter(email__endswith="@demo.carefree.local").exclude(email__in=generated_emails)
        stale_count = stale_demo_users.count()
        if stale_count:
            stale_demo_users.delete()
            self.stdout.write(self.style.WARNING(f"Removed {stale_count} stale demo caretaker user(s) without a matching image."))

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Demo caretaker seeding complete. Created: {created}, updated: {updated}."))
        self.stdout.write(f"Shared password for demo caretakers: {options['password']}")

    def _image_sort_key(self, path: Path):
        stem = path.stem.lower()
        prefix = stem[:2]
        numeric_part = stem[2:]
        try:
            number = int(numeric_part)
        except ValueError:
            number = 10_000
        return prefix, number, path.name.lower()

    def _sex_from_image_name(self, filename: str) -> str:
        lowered = filename.lower()
        if lowered.startswith("w_"):
            return "F"
        if lowered.startswith("m_"):
            return "M"
        raise CommandError(f"Unsupported demo image filename: {filename}")

    def _first_name_for_sex(self, sex: str, counter: int) -> str:
        names = FEMALE_FIRST_NAMES if sex == "F" else MALE_FIRST_NAMES
        return names[(counter - 1) % len(names)]

    def _build_about_me(self, index: int, sex: str, focus: str, grad_year: int) -> str:
        completed_studies = "završila" if sex == "F" else "završio"
        return (
            f"{ABOUT_ME_OPTIONS[(index - 1) % len(ABOUT_ME_OPTIONS)]} "
            f"Teme s kojima najčešće radim uključuju {focus}. "
            f"Psihologiju sam {completed_studies} {grad_year}. godine, a u radu njegujem profesionalan, smiren i nenametljiv pristup."
        )

    def _experience_years_for_image(self, filename: str, index: int) -> int:
        special_value = SPECIAL_EXPERIENCE_YEARS.get(filename.lower())
        if special_value is not None:
            return special_value

        baseline_years = [8, 9, 10, 11, 12, 13, 14]
        return baseline_years[(index - 1) % len(baseline_years)]

    def _build_phone(self, index: int) -> str:
        prefixes = ["91", "92", "95", "97", "98", "99"]
        prefix = prefixes[(index - 1) % len(prefixes)]
        suffix = f"{4100000 + index * 173:07d}"[-7:]
        return f"+385 {prefix} {suffix[:3]} {suffix[3:]}"

    def _choose_categories(self, categories, index: int):
        count = 2 + (index % 3)
        start = (index * 2) % len(categories)
        chosen = []
        for offset in range(count):
            chosen.append(categories[(start + offset) % len(categories)])
        return chosen

    def _replace_cv(self, caretaker: Caretaker, pdf_bytes: bytes, index: int):
        cv, _ = CaretakerCV.objects.get_or_create(caretaker=caretaker)
        filename = f"cv_{caretaker.user.last_name.lower()}_{index:02d}.pdf"
        cv.file.save(filename, ContentFile(pdf_bytes), save=False)
        cv.original_filename = filename
        cv.mime_type = "application/pdf"
        cv.save()

    def _replace_diplomas(self, caretaker: Caretaker, pdf_bytes: bytes, degree: str, grad_year: int, index: int):
        caretaker.diplomas.all().delete()
        diploma_count = 1 + (index % 2)
        for diploma_idx in range(1, diploma_count + 1):
            diploma = Diploma(caretaker=caretaker)
            filename = f"diploma_{grad_year}_{slugify(degree)}_{index:02d}_{diploma_idx}.pdf"
            diploma.file.save(filename, ContentFile(pdf_bytes), save=False)
            diploma.original_filename = filename
            diploma.mime_type = "application/pdf"
            diploma.save()

    def _replace_certificates(self, caretaker: Caretaker, pdf_bytes: bytes, index: int):
        caretaker.certificates.all().delete()
        certificate_count = index % 3
        for cert_idx in range(1, certificate_count + 1):
            title = CERTIFICATE_NAMES[(index + cert_idx - 2) % len(CERTIFICATE_NAMES)]
            certificate = Certificate(caretaker=caretaker)
            filename = f"certifikat_{slugify(title)}_{index:02d}_{cert_idx}.pdf"
            certificate.file.save(filename, ContentFile(pdf_bytes), save=False)
            certificate.original_filename = filename
            certificate.mime_type = "application/pdf"
            certificate.save()

    def _replace_availability(self, caretaker: Caretaker, index: int, tz: ZoneInfo):
        now_local = timezone.now().astimezone(tz)
        start_day = now_local.date()
        end_day = start_day + timedelta(days=(13 - start_day.weekday()) % 7 + 7)
        future_start = timezone.now()
        caretaker.availability_slots.filter(start__gte=future_start).delete()

        hour_sets = [
            [8, 9, 13, 14, 16],
            [9, 10, 14, 15, 17],
            [8, 10, 12, 15, 16],
            [9, 11, 13, 16, 17],
            [8, 9, 12, 14, 17],
        ][(index - 1) % 5]

        total_days = (end_day - start_day).days + 1

        for day_offset in range(total_days):
            current_day = start_day + timedelta(days=day_offset)
            weekday = current_day.weekday()
            if weekday == 6:
                continue

            daily_hours = hour_sets[:]
            if weekday == 5:
                daily_hours = daily_hours[:2]
            elif (day_offset + index) % 3 == 0:
                daily_hours = daily_hours[:-1]

            for hour in daily_hours:
                local_start = datetime(
                    current_day.year,
                    current_day.month,
                    current_day.day,
                    hour,
                    0,
                    tzinfo=tz,
                )
                if local_start <= now_local:
                    continue
                utc_start = local_start.astimezone(ZoneInfo("UTC"))
                utc_end = utc_start + timedelta(hours=1)
                AvailabilitySlot.objects.update_or_create(
                    caretaker=caretaker,
                    start=utc_start,
                    defaults={
                        "end": utc_end,
                        "is_available": True,
                    },
                )
