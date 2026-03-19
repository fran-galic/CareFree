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


FIRST_NAMES = [
    "Ana", "Petra", "Iva", "Marija", "Katarina", "Lucija", "Ivana", "Matea",
    "Tea", "Nika", "Tena", "Dora", "Ema", "Sara", "Lea", "Filip", "Ivan",
    "Luka", "Marko", "Josip", "Karlo", "Matej", "Tin",
]

LAST_NAMES = [
    "Horvat", "Kovačević", "Babić", "Marić", "Perić", "Novak", "Božić", "Jurić",
    "Knežević", "Tomić", "Pavlović", "Milić", "Grgić", "Lovrić", "Blažević",
    "Rukavina", "Vuković", "Petrović", "Mlinarić", "Kralj", "Vidović", "Kovač", "Lukić",
]

ABOUT_ME_OPTIONS = [
    "Radim sa studentima koji prolaze kroz anksioznost, akademski pritisak i osjećaj preopterećenosti. Fokus mi je na mirnom, strukturiranom razgovoru i konkretnim koracima koji pomažu vratiti osjećaj kontrole.",
    "Posebno me zanimaju teme samopouzdanja, perfekcionizma i odnosa prema vlastitim očekivanjima. U radu nastojim stvoriti siguran prostor u kojem student može bez pritiska govoriti o onome što ga muči.",
    "Imam iskustvo u savjetovanju mladih odraslih osoba koje se nose s promjenama, usamljenosti i krizama motivacije. Važno mi je da razgovor bude topao, jasan i praktično koristan.",
    "Najčešće radim s temama stresa, emocionalne iscrpljenosti i poteškoća u organizaciji obaveza. Volim kombinirati podršku, psihoedukaciju i male izvedive korake između susreta.",
    "U radu sam smirena, direktna i usmjerena na to da osoba osjeti kako nije sama u onome što prolazi. Bliske su mi teme odnosa, granica, samopoštovanja i prilagodbe na nove životne faze.",
    "Studentima najčešće pomažem kada se osjećaju blokirano, izgubljeno ili preopterećeno. Zajedno radimo na razumijevanju obrasca, regulaciji stresa i traženju održivog ritma.",
    "Volim raditi s osobama koje osjećaju unutarnji pritisak, strah od neuspjeha ili poteškoće u donošenju odluka. Moj pristup je podržavajući, ali i dovoljno strukturiran da razgovor vodi prema promjeni.",
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

DEGREE_TITLES = [
    "mag. psych.",
    "univ. mag. psych.",
    "magistra psihologije",
]

CERTIFICATE_NAMES = [
    "uvod u kognitivno-bihevioralne tehnike",
    "savjetovanje mladih odraslih osoba",
    "osnove kriznih intervencija",
    "emocionalna regulacija i rad sa stresom",
    "komunikacijske i relacijske vještine u savjetovanju",
]


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
            if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png"}
        )
        if not image_paths:
            raise CommandError(f"No demo images found in {demo_dir}")

        count = options["count"] or len(image_paths)
        if count <= 0:
            raise CommandError("Count must be greater than zero.")
        if count > len(image_paths):
            self.stdout.write(self.style.WARNING(
                f"Requested {count} demo caretakers, but only {len(image_paths)} images exist. Using all available images."
            ))
            count = len(image_paths)

        pdf_path = demo_dir / "moguce_teme_za_projekt.pdf"
        if not pdf_path.exists():
            raise CommandError(f"Missing mock PDF file: {pdf_path}")

        call_command("seed_help_categories")
        leaf_categories = list(HelpCategory.objects.filter(parent__isnull=False).order_by("id"))
        root_categories = list(HelpCategory.objects.filter(parent__isnull=True).order_by("id"))
        categories = leaf_categories or root_categories
        if not categories:
            raise CommandError("No HelpCategory records available even after seeding.")

        image_paths = image_paths[:count]
        pdf_bytes = pdf_path.read_bytes()
        User = get_user_model()
        tz = ZoneInfo("Europe/Zagreb")

        created = 0
        updated = 0

        for index, image_path in enumerate(image_paths, start=1):
            first_name = FIRST_NAMES[(index - 1) % len(FIRST_NAMES)]
            last_name = LAST_NAMES[(index - 1) % len(LAST_NAMES)]
            grad_year = 2010 + ((index * 2) % 13)
            age = max(27, min(58, timezone.now().year - grad_year + 24 + (index % 4)))
            sex = "F" if index <= 15 else "M"
            username = f"demo-caretaker-{index:02d}-{slugify(first_name)}-{slugify(last_name)}"
            email = f"{slugify(first_name)}.{slugify(last_name)}.{index:02d}@demo.carefree.local"

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
            degree = DEGREE_TITLES[(index - 1) % len(DEGREE_TITLES)]
            about_me = (
                f"{ABOUT_ME_OPTIONS[(index - 1) % len(ABOUT_ME_OPTIONS)]} "
                f"Područja rada uključuju {focus}. "
                f"Završio/la sam psihologiju {grad_year}. godine i njegujem topao, profesionalan i nenametljiv pristup."
            )

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
                    f"{first_name} {last_name} ({email})"
                )
            )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Demo caretaker seeding complete. Created: {created}, updated: {updated}."))
        self.stdout.write(f"Shared password for demo caretakers: {options['password']}")

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
        future_start = timezone.now()
        caretaker.availability_slots.filter(start__gte=future_start).delete()

        preferred_days = [
            [0, 2, 4],
            [1, 3, 4],
            [0, 1, 3],
            [2, 4, 5],
            [0, 2, 3],
        ][(index - 1) % 5]
        hour_sets = [
            [9, 10, 14, 15],
            [10, 11, 16, 17],
            [8, 9, 13, 14],
            [11, 12, 17, 18],
            [9, 13, 15, 18],
        ][(index - 1) % 5]

        for day_offset in range(14):
            current_day = start_day + timedelta(days=day_offset)
            if current_day.weekday() not in preferred_days:
                continue

            daily_hours = hour_sets[:]
            if (day_offset + index) % 4 == 0:
                daily_hours = daily_hours[:-1]
            if current_day.weekday() == 5:
                daily_hours = daily_hours[:2]

            for hour in daily_hours:
                local_start = datetime(
                    current_day.year,
                    current_day.month,
                    current_day.day,
                    hour,
                    0,
                    tzinfo=tz,
                )
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
