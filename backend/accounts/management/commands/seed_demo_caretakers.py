from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify

from accounts.models import Caretaker, CaretakerCV, Certificate, Diploma, HelpCategory, Student
from appointments.models import AvailabilitySlot, AppointmentRequest, Appointment, AppointmentFeedback, CalendarEventLog


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

DEMO_STUDENT_PROFILES = [
    {
        "email": "demo.student@carefree.local",
        "username": "demo-student-01",
        "first_name": "Demo",
        "last_name": "Student",
        "age": 22,
        "sex": "F",
        "studying_at": "FER",
        "year_of_study": 3,
    },
    {
        "email": "lea.student@carefree.local",
        "username": "demo-student-02",
        "first_name": "Lea",
        "last_name": "Student",
        "age": 21,
        "sex": "F",
        "studying_at": "FFZG",
        "year_of_study": 2,
    },
    {
        "email": "ivan.student@carefree.local",
        "username": "demo-student-03",
        "first_name": "Ivan",
        "last_name": "Student",
        "age": 24,
        "sex": "M",
        "studying_at": "TVZ",
        "year_of_study": 4,
    },
    {
        "email": "petra.student@carefree.local",
        "username": "demo-student-04",
        "first_name": "Petra",
        "last_name": "Student",
        "age": 23,
        "sex": "F",
        "studying_at": "PMF",
        "year_of_study": 5,
    },
]

ABOUT_ME_OPTIONS = [
    "U radu sa studentima nastojim ponuditi siguran, smiren i povjerljiv prostor u kojem je moguće otvoreno govoriti o onome što opterećuje, bez pritiska i bez osjećaja da se sve mora odmah riješiti.",
    "Važno mi je da se student tijekom susreta osjeća saslušano i razumijeno. Razgovor vodim mirno i strukturirano, s fokusom na ono što osobi u tom trenutku može donijeti više jasnoće, olakšanja i oslonca.",
    "U savjetovanju mi je cilj pomoći studentu da bolje razumije vlastite obrasce, emocije i izvore pritiska, te da kroz razgovor pronađe održiviji i sigurniji način nošenja s onim kroz što prolazi.",
    "Pristupam radu profesionalno, toplo i nenametljivo. Posebno mi je važno da susret ne ostane samo na razgovoru, nego da student iz njega ponese veći osjećaj stabilnosti, usmjerenja i povjerenja u vlastite kapacitete.",
    "Studentima nastojim pružiti prostor u kojem mogu stati, predahnuti i jasnije sagledati ono što ih opterećuje. U radu njegujem strpljenje, poštovanje i tempo koji je prilagođen osobi s kojom radim.",
    "Vjerujem da kvalitetan terapijski odnos počinje osjećajem sigurnosti i prihvaćenosti. Zato mi je važno graditi suradnju u kojoj student može iskreno govoriti o svojim brigama, dilemama i unutarnjem pritisku.",
    "U radu kombiniram razumijevanje, jasnu strukturu i praktičnu usmjerenost. Cilj mi je da student kroz susrete dobije više unutarnje jasnoće, bolju emocionalnu regulaciju i osjećaj da nije sam u onome što proživljava.",
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

REQUEST_MESSAGE_TEMPLATES = [
    "Već neko vrijeme osjećam pritisak oko fakulteta i teško se smirim nakon obaveza. Volio/la bih razgovarati o tome kako da se lakše nosim s tim.",
    "U zadnje vrijeme osjećam dosta tjeskobe i teško mi je sabrati misli kada se obaveze nagomilaju. Treba mi razgovor i malo više jasnoće oko onoga što mi se događa.",
    "Primjećujem da sam stalno napet/a i da mi je teško odvojiti odmor od fakultetskih obaveza. Volio/la bih popričati s psihologom o tome.",
    "Muči me kombinacija stresa, umora i osjećaja da stalno kasnim za svime. Htio/la bih dobiti sigurniji prostor za razgovor i vidjeti što mi može pomoći.",
]

AI_SUMMARY_TEMPLATES = [
    "Student opisuje izražen akademski stres, osjećaj preopterećenosti i potrebu za prvim razgovorom s psihologom.",
    "Student navodi pojačanu tjeskobu, unutarnji pritisak i poteškoće s nošenjem s obavezama te traži stručnu podršku.",
    "Studentu se u zadnje vrijeme pojačavaju napetost i umor, želi bolje razumjeti što prolazi i pronaći prikladnu podršku.",
    "Student opisuje emocionalno opterećenje, pad koncentracije i potrebu za strukturiranim razgovorom sa stručnom osobom.",
]

FEEDBACK_COMMENTS = [
    "Nakon razgovora osjećam se mirnije i imam jasniju sliku što me najviše opterećuje. Pomoglo mi je što je razgovor bio smiren i strukturiran.",
    "Susret mi je pomogao da usporim i malo jasnije sagledam što mi stvara najveći pritisak. Osjećam da imam više prostora za disanje.",
    "Dobio/la sam više jasnoće i osjećaj da ipak mogu korak po korak riješiti ono što me preplavljuje. Razgovor mi je bio koristan i ugodan.",
    "Još uvijek procesuiram dojam nakon razgovora, ali osjećam da sam otvorio/la važne teme i da mi je koristilo što sam ih izgovorio/la naglas.",
]

WORK_APPROACH_SEQUENCE = [
    Caretaker.WORK_APPROACH_INTEGRATIVE,
    Caretaker.WORK_APPROACH_CBT,
    Caretaker.WORK_APPROACH_HUMANISTIC,
    Caretaker.WORK_APPROACH_SYSTEMIC,
    Caretaker.WORK_APPROACH_GESTALT,
    Caretaker.WORK_APPROACH_ACT,
    Caretaker.WORK_APPROACH_PSYCHODYNAMIC,
    Caretaker.WORK_APPROACH_REBT,
    Caretaker.WORK_APPROACH_DBT,
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
        parser.add_argument(
            "--student-password",
            default="DemoStudent123!",
            help="Password assigned to the generated demo student.",
        )
        parser.add_argument(
            "--student-count",
            type=int,
            default=4,
            help="How many demo students to create. Default: 4.",
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
        seeded_caretakers = []

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
            caretaker.work_approach = WORK_APPROACH_SEQUENCE[(index - 1) % len(WORK_APPROACH_SEQUENCE)]
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

            seeded_caretakers.append(caretaker)

            self.stdout.write(
                self.style.SUCCESS(
                    f"{'Created' if was_created else 'Updated'} demo caretaker {index:02d}: "
                    f"{first_name} {last_name} ({email}, {image_path.name})"
                )
            )

        demo_students = self._seed_demo_students(User, options["student_password"], options["student_count"])
        generated_demo_emails = generated_emails + [student.user.email for student in demo_students]
        stale_demo_users = User.objects.filter(email__endswith="@demo.carefree.local").exclude(email__in=generated_demo_emails)
        stale_count = stale_demo_users.count()
        if stale_count:
            stale_demo_users.delete()
            self.stdout.write(self.style.WARNING(f"Removed {stale_count} stale demo user(s) without a matching current seed profile."))

        if seeded_caretakers and demo_students:
            self._seed_demo_activity(demo_students, seeded_caretakers, tz)

        self._write_local_credentials_snapshot(
            seeded_caretakers=seeded_caretakers,
            demo_students=demo_students,
            caretaker_password=options["password"],
            student_password=options["student_password"],
        )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Demo caretaker seeding complete. Created: {created}, updated: {updated}."))
        self.stdout.write(f"Shared password for demo caretakers: {options['password']}")
        self.stdout.write(f"Demo student password: {options['student_password']}")
        self.stdout.write(f"Local credentials snapshot: {base_dir / 'generated' / 'LOCAL_DEMO_CREDENTIALS.md'}")

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

    def _seed_demo_students(self, User, password: str, student_count: int):
        if student_count <= 0:
            return []

        selected_profiles = DEMO_STUDENT_PROFILES[:student_count]
        if len(selected_profiles) < student_count:
            raise CommandError(
                f"Requested {student_count} demo students, but only {len(DEMO_STUDENT_PROFILES)} predefined profiles exist."
            )

        students = []
        for profile in selected_profiles:
            user, _ = User.objects.update_or_create(
                email=profile["email"],
                defaults={
                    "username": profile["username"],
                    "first_name": profile["first_name"],
                    "last_name": profile["last_name"],
                    "age": profile["age"],
                    "sex": profile["sex"],
                    "role": "student",
                },
            )
            user.set_password(password)
            user.save(update_fields=["password"])

            student, _ = Student.objects.update_or_create(
                user=user,
                defaults={
                    "studying_at": profile["studying_at"],
                    "year_of_study": profile["year_of_study"],
                    "is_anonymous": True,
                },
            )
            students.append(student)
        return students

    def _seed_demo_activity(self, demo_students: list[Student], caretakers: list[Caretaker], tz: ZoneInfo):
        if not demo_students or not caretakers:
            return

        student_ids = [student.pk for student in demo_students]
        caretaker_ids = [caretaker.pk for caretaker in caretakers]

        AppointmentFeedback.objects.filter(
            Q(student_id__in=student_ids) | Q(caretaker_id__in=caretaker_ids)
        ).delete()
        Appointment.objects.filter(
            Q(student_id__in=student_ids) | Q(caretaker_id__in=caretaker_ids)
        ).delete()
        AppointmentRequest.objects.filter(
            Q(student_id__in=student_ids) | Q(caretaker_id__in=caretaker_ids)
        ).delete()

        now_local = timezone.now().astimezone(tz)
        future_slot_pool = self._build_future_slot_pool(caretakers)

        for index, caretaker in enumerate(caretakers, start=1):
            primary_student = demo_students[(index - 1) % len(demo_students)]
            secondary_student = demo_students[index % len(demo_students)]
            tertiary_student = demo_students[(index + 1) % len(demo_students)]
            fallback_student = demo_students[(index + 2) % len(demo_students)]

            main_label = (
                caretaker.help_categories.filter(parent__isnull=True).values_list("label", flat=True).first()
                or caretaker.help_categories.values_list("label", flat=True).first()
                or "Stres i akademski pritisci"
            )

            pending_count = 3 if index <= 3 else 1
            for pending_idx in range(pending_count):
                slot = self._consume_future_slot(future_slot_pool, caretaker.pk, fallback_days=1 + pending_idx + index)
                self._create_request_only(
                    student=demo_students[(index + pending_idx) % len(demo_students)],
                    caretaker=caretaker,
                    start_utc=slot,
                    message=self._build_request_message(main_label, index + pending_idx),
                    status=AppointmentRequest.STATUS_PENDING,
                    ai_context=self._build_ai_context(main_label, index + pending_idx) if (index + pending_idx) % 2 == 0 else None,
                )

            slot = self._consume_future_slot(future_slot_pool, caretaker.pk, fallback_days=4 + (index % 4))
            appointment_status = (
                Appointment.STATUS_SYNC_FAILED
                if index % 5 == 0
                else Appointment.STATUS_CONFIRMED
            )
            self._create_request_and_appointment(
                student=secondary_student,
                caretaker=caretaker,
                start_utc=slot,
                message=self._build_request_message(main_label, index + 20),
                appointment_status=appointment_status,
                ai_context=self._build_ai_context(main_label, index + 20) if index % 2 == 1 else None,
                include_fake_meet=appointment_status == Appointment.STATUS_CONFIRMED,
                seed_offset=index + 20,
            )

            past_days = 2 + (index % 8)
            past_hour = 9 + (index % 7)
            completed_start_local = (now_local - timedelta(days=past_days)).replace(
                hour=past_hour,
                minute=0,
                second=0,
                microsecond=0,
            )
            completed_start_utc = completed_start_local.astimezone(ZoneInfo("UTC"))
            completed_request, completed_appointment = self._create_request_and_appointment(
                student=tertiary_student,
                caretaker=caretaker,
                start_utc=completed_start_utc,
                message=self._build_request_message(main_label, index + 40),
                appointment_status=Appointment.STATUS_COMPLETED,
                ai_context=self._build_ai_context(main_label, index + 40) if index % 3 != 0 else None,
                include_fake_meet=index % 2 == 0,
                seed_offset=index + 40,
            )

            should_create_feedback = index % 4 != 0
            if should_create_feedback:
                self._create_feedback(
                    appointment=completed_appointment,
                    student=tertiary_student,
                    caretaker=caretaker,
                    seed_offset=index,
                )

            if index <= 6:
                rejected_slot = self._consume_future_slot(future_slot_pool, caretaker.pk, fallback_days=7 + index)
                self._create_request_only(
                    student=fallback_student,
                    caretaker=caretaker,
                    start_utc=rejected_slot,
                    message=self._build_request_message(main_label, index + 60),
                    status=AppointmentRequest.STATUS_REJECTED,
                    ai_context=self._build_ai_context(main_label, index + 60) if index % 2 == 0 else None,
                )

        self.stdout.write(self.style.SUCCESS("Demo activity seeded: pending requests, confirmed/completed appointments, feedback and AI context."))

    def _build_future_slot_pool(self, caretakers: list[Caretaker]) -> dict[int, list[datetime]]:
        now = timezone.now()
        pool: dict[int, list[datetime]] = {}
        for caretaker in caretakers:
            pool[caretaker.pk] = list(
                AvailabilitySlot.objects.filter(
                    caretaker=caretaker,
                    start__gt=now,
                    is_available=True,
                )
                .order_by("start")
                .values_list("start", flat=True)
            )
        return pool

    def _consume_future_slot(self, pool: dict[int, list[datetime]], caretaker_id: int, *, fallback_days: int) -> datetime:
        slots = pool.get(caretaker_id) or []
        if slots:
            return slots.pop(0)
        return timezone.now() + timedelta(days=fallback_days, hours=10)

    def _build_request_message(self, main_label: str, seed_offset: int) -> str:
        base = REQUEST_MESSAGE_TEMPLATES[seed_offset % len(REQUEST_MESSAGE_TEMPLATES)]
        if main_label:
            return f"{base} Najviše me trenutno opterećuju teme povezane s područjem: {main_label.lower()}."
        return base

    def _build_ai_context(self, main_label: str, seed_offset: int) -> dict:
        summary = AI_SUMMARY_TEMPLATES[seed_offset % len(AI_SUMMARY_TEMPLATES)]
        transcript = [
            {
                "sender": "student",
                "content": self._build_request_message(main_label, seed_offset),
                "created_at": (timezone.now() - timedelta(minutes=12)).isoformat(),
                "sequence": 1,
            },
            {
                "sender": "bot",
                "content": "Hvala ti što si to podijelio/la. Možemo polako proći kroz ono što ti trenutno stvara najviše pritiska i vidjeti kakva bi ti podrška mogla najviše odgovarati.",
                "created_at": (timezone.now() - timedelta(minutes=11)).isoformat(),
                "sequence": 2,
            },
            {
                "sender": "student",
                "content": "Najviše mi se skupljaju napetost, umor i osjećaj da ne uspijevam držati korak sa svime.",
                "created_at": (timezone.now() - timedelta(minutes=9)).isoformat(),
                "sequence": 3,
            },
            {
                "sender": "bot",
                "content": "Izdvojit ću nekoliko psihologa koji rade s ovakvim temama kako bi ti sljedeći korak bio što lakši.",
                "created_at": (timezone.now() - timedelta(minutes=8)).isoformat(),
                "sequence": 4,
            },
        ]
        return {
            "summary": summary,
            "category": main_label,
            "crisis_flag": "kriz" in main_label.casefold(),
            "transcript_shared": seed_offset % 3 == 0,
            "transcript_snapshot": transcript,
        }

    def _create_request_only(
        self,
        *,
        student: Student,
        caretaker: Caretaker,
        start_utc: datetime,
        message: str,
        status: str,
        ai_context: dict | None = None,
    ) -> AppointmentRequest:
        end_utc = start_utc + timedelta(hours=1)
        return AppointmentRequest.objects.create(
            student=student,
            caretaker=caretaker,
            requested_start=start_utc,
            requested_end=end_utc,
            message="" if ai_context else message,
            ai_summary=(ai_context or {}).get("summary") or None,
            ai_category=(ai_context or {}).get("category") or None,
            crisis_flag=bool((ai_context or {}).get("crisis_flag")),
            ai_transcript_shared=bool((ai_context or {}).get("transcript_shared")),
            ai_transcript_snapshot=(ai_context or {}).get("transcript_snapshot") if (ai_context or {}).get("transcript_shared") else [],
            status=status,
        )

    def _create_request_and_appointment(
        self,
        *,
        student: Student,
        caretaker: Caretaker,
        start_utc: datetime,
        message: str,
        appointment_status: str,
        ai_context: dict | None,
        include_fake_meet: bool,
        seed_offset: int,
    ) -> tuple[AppointmentRequest, Appointment]:
        request = self._create_request_only(
            student=student,
            caretaker=caretaker,
            start_utc=start_utc,
            message=message,
            status=AppointmentRequest.STATUS_ACCEPTED,
            ai_context=ai_context,
        )
        appointment = Appointment.objects.create(
            appointment_request=request,
            caretaker=caretaker,
            student=student,
            start=start_utc,
            end=start_utc + timedelta(hours=1),
            duration_minutes=60,
            status=appointment_status,
            external_event_id=f"demo-event-{caretaker.pk}-{student.pk}-{seed_offset}",
            calendar_id="carefree-demo-calendar@local",
            conference_link=self._fake_meet_link(seed_offset) if include_fake_meet else None,
            metadata={
                "seeded_demo": True,
                "seed_offset": seed_offset,
            },
        )
        CalendarEventLog.objects.create(
            appointment=appointment,
            operation=CalendarEventLog.OP_CREATE,
            external_id=appointment.external_event_id,
            request_payload={
                "summary": "Sastanak - CareFree",
                "description": request.ai_summary or request.message or "",
            },
            response_payload={
                "conference_link": appointment.conference_link,
                "calendar_id": appointment.calendar_id,
                "seeded_demo": True,
            },
            status="success" if appointment.conference_link else "demo_seeded_without_link",
            attempts=1,
            last_attempted_at=timezone.now(),
        )
        return request, appointment

    def _create_feedback(self, *, appointment: Appointment, student: Student, caretaker: Caretaker, seed_offset: int):
        responses = [
            AppointmentFeedback.RESPONSE_CALMER,
            AppointmentFeedback.RESPONSE_HELPED,
            AppointmentFeedback.RESPONSE_CLEARER,
            AppointmentFeedback.RESPONSE_PROCESSING,
        ]
        response = responses[seed_offset % len(responses)]
        comment = FEEDBACK_COMMENTS[seed_offset % len(FEEDBACK_COMMENTS)]
        AppointmentFeedback.objects.create(
            appointment=appointment,
            student=student,
            caretaker=caretaker,
            status=AppointmentFeedback.STATUS_SUBMITTED,
            selected_response=response,
            comment=comment,
        )

    def _fake_meet_link(self, seed_offset: int) -> str:
        alphabet = "abcdefghijklmnopqrstuvwxyz"
        first = "".join(alphabet[(seed_offset + i) % len(alphabet)] for i in range(3))
        second = "".join(alphabet[(seed_offset * 2 + i) % len(alphabet)] for i in range(4))
        third = "".join(alphabet[(seed_offset * 3 + i) % len(alphabet)] for i in range(3))
        return f"https://meet.google.com/{first}-{second}-{third}"

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

    def _write_local_credentials_snapshot(
        self,
        *,
        seeded_caretakers: list[Caretaker],
        demo_students: list[Student],
        caretaker_password: str,
        student_password: str,
    ):
        base_dir = Path(__file__).resolve().parents[4]
        output_dir = base_dir / "generated"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / "LOCAL_DEMO_CREDENTIALS.md"

        lines = [
            "# Local Demo Credentials",
            "",
            "Ovaj dokument je automatski generiran iz `seed_demo_caretakers` komande.",
            "Namijenjen je lokalnom/demo korištenju i ignoriran je u Git-u.",
            "",
            "## Admin",
            "",
            "- email: `admin@carefree.com`",
            "- password: `admin123`",
            "",
            "## Demo caretakers",
            "",
            f"- shared password: `{caretaker_password}`",
            "",
        ]

        for caretaker in seeded_caretakers:
            lines.append(f"- `{caretaker.user.email}` | {caretaker.user.first_name} {caretaker.user.last_name}")

        lines.extend([
            "",
            "## Demo students",
            "",
            f"- shared password: `{student_password}`",
            "",
        ])

        for student in demo_students:
            lines.append(
                f"- `{student.user.email}` | {student.user.first_name} {student.user.last_name} | {student.studying_at}, godina {student.year_of_study}"
            )

        output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
