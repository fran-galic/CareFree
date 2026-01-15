from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
import random

try:
    from faker import Faker
except Exception:
    Faker = None

from accounts.models import Caretaker, HelpCategory

class Command(BaseCommand):
    help = "Generate random Caretakers with categories and subcategories."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=20, help="How many caretakers to create")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Delete existing Caretaker objects before seeding",
        )
        parser.add_argument(
            "--approve",
            action="store_true",
            help="Automatically approve all generated caretakers",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        count = options.get("count") or 20
        fake = Faker() if Faker else None

        if options.get("force"):
            try:
                user_qs = User.objects.filter(username__startswith='caretaker_')
                deleted_users = user_qs.count()
                user_qs.delete()
                self.stdout.write(self.style.WARNING(f"Deleted {deleted_users} User objects with username starting with 'caretaker_'."))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"Failed deleting User objects: {e}"))

        categories = list(HelpCategory.objects.all())
        if not categories:
            self.stdout.write(self.style.WARNING(
                "No HelpCategory objects found in DB; caretakers will have no categories. Run seed_help_categories to populate categories."
            ))

        created = 0
        skipped = 0

        for i in range(count):
            if fake:
                first = fake.first_name()
                last = fake.last_name()
            else:
                first = f"Ime{i}"
                last = f"Prez{i}"

            username = f"caretaker_{first.lower()}_{last.lower()}_{i}"
            email = f"{username}@example.local"

            user, was_created = User.objects.get_or_create(
                username=username,
                defaults={"first_name": first, "last_name": last, "email": email, "role": "caretaker"},
            )

            if was_created:
                try:
                    user.set_password("password123")
                    user.save()
                except Exception:
                    user.save()

                caretaker, _ = Caretaker.objects.get_or_create(user=user)

                if options.get("approve"):
                    caretaker.is_approved = True

                if categories:
                    chosen = random.sample(categories, k=min(len(categories), random.randint(1, 3)))
                    try:
                        caretaker.help_categories.set(chosen)
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"Warning setting categories: {e}"))

                caretaker.save()
                created += 1
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(f"Done. Created {created} caretakers, skipped {skipped} existing users."))
