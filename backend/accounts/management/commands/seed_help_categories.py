from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from accounts.models import HelpCategory


class Command(BaseCommand):
    help = "Seed HelpCategory roots and subcategories from predefined list"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Delete existing HelpCategory objects before seeding",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options.get("force"):
            HelpCategory.objects.all().delete()
            self.stdout.write(self.style.WARNING("Deleted existing HelpCategory objects."))

        data = [
            ("Stres i akademski pritisci", [
                "Strah od ispita i loših ocjena",
                "Preopterećenost obavezama",
                "Problemi s organizacijom vremena i prokrastinacija",
            ]),
            ("Anksiozni poremećaji", [
                "Generalizirani anksiozni poremećaj",
                "Socijalna anksioznost (strah od javnog nastupa, kontakta s profesorima/vršnjacima)",
                "Panični napadi",
            ]),
            ("Depresivni simptomi", [
                "Tuga, gubitak interesa za aktivnosti",
                "Umor i demotivacija",
                "Nisko samopouzdanje i osjećaj bespomoćnosti",
            ]),
            ("Problemi u međuljudskim odnosima", [
                "Sukobi s kolegama, prijateljima ili partnerima",
                "Problemi s komunikacijom i asertivnošću",
                "Osjećaj izolacije i usamljenosti",
            ]),
            ("Poremećaji spavanja", [
                "Nesanicu ili nepravilne navike spavanja",
                "Posljedice kroničnog umora na koncentraciju i raspoloženje",
            ]),
            ("Problemi samopouzdanja i identiteta", [
                "Sumnja u vlastite sposobnosti",
                "Nesigurnost u odabir studija ili karijere",
                "Osobni razvoj i pronalazak smisla",
            ]),
            ("Poremećaji prehrane i tjelesne slike", [
                "Anoreksija",
                "Bulimija",
                "Prejedanje",
                "Negativna tjelesna slika i poremećena percepcija sebe",
            ]),
            ("Emocionalna regulacija i impulzivno ponašanje", [
                "Nagli ispadi bijesa ili frustracije",
                "Problemi s kontrolom impulsa",
                "Ovisničko ponašanje (društvene mreže, kockanje, alkohol)",
            ]),
            ("Trauma i stresne životne situacije", [
                "Gubitak bliske osobe",
                "Obiteljski problemi ili zlostavljanje",
                "Adaptacija na novi životni period (selidba, fakultet u drugom gradu)",
            ]),
            ("Seksualnost", [
                "Propitivanje vlastite seksualnosti",
                "Anksioznost vezana za stupanje u spolne odnose",
            ]),
            ("OSTALO", []),
        ]

        created = 0
        existed = 0

        for root_label, sublabels in data:
            root_defaults = {"slug": slugify(root_label)}
            root, root_created = HelpCategory.objects.get_or_create(
                label=root_label, defaults=root_defaults
            )
            if root_created:
                created += 1
            else:
                existed += 1

            for sub in sublabels:
                sub_defaults = {"slug": slugify(sub)}
                subcat, sub_created = HelpCategory.objects.get_or_create(
                    label=sub, parent=root, defaults=sub_defaults
                )
                if sub_created:
                    created += 1
                else:
                    existed += 1

        self.stdout.write(self.style.SUCCESS(f"Done. Created {created} categories, {existed} already existed."))
