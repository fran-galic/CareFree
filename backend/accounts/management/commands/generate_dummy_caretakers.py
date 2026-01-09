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
    help = "Generate dummy Caretaker objects (with users and categories)"

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=45, help="How many caretakers to create")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Delete existing HelpCategory objects before seeding",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        count = options.get("count") or 45
        fake = Faker() if Faker else None

        # Optionally delete existing Caretaker objects when --force is used
        if options.get("force"):
            try:
                deleted = Caretaker.objects.count()
                Caretaker.objects.all().delete()
                self.stdout.write(self.style.WARNING(f"Deleted {deleted} existing Caretaker objects."))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"Failed deleting Caretaker objects: {e}"))

        # Load help categories from the database (do not create hardcoded ones here)
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
                defaults={"first_name": first, "last_name": last, "email": email},
            )

            if was_created:
                try:
                    user.set_password("password123")
                    user.save()
                except Exception:
                    # If setting password fails for custom user model, ignore
                    user.save()

                caretaker, _ = Caretaker.objects.get_or_create(user=user)

                # Optionally populate some caretaker fields if they exist
                try:
                    if fake and hasattr(caretaker, "bio"):
                        caretaker.bio = fake.text(max_nb_chars=200)
                    if hasattr(caretaker, "phone"):
                        caretaker.phone = f"+385{random.randint(900000000, 999999999)}"
                    caretaker.save()
                except Exception:
                    # best-effort: continue if optional fields don't exist
                    caretaker.save()

                # Assign 1-3 random categories
                if categories:
                    chosen = random.sample(categories, k=min(len(categories), random.randint(1, 3)))
                    try:
                        caretaker.help_categories.set(chosen)
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"Warning setting categories: {e}"))

                created += 1
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(f"Done. Created {created} caretakers, skipped {skipped} existing users."))
