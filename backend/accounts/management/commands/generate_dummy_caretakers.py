from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.core.files.base import ContentFile
import random
import requests
import os

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
            age = random.randint(20, 99)

            user, was_created = User.objects.get_or_create(
                username=username,
                defaults={"first_name": first, "last_name": last, "email": email, "age": age, "sex": "O", "role": "caretaker"},
            )

            if was_created:
                try:
                    user.set_password("password123")
                    user.save()
                except Exception:
                    # If setting password fails for custom user model, ignore
                    user.save()

            # Update role for existing user if not already set
            if not user.role:
                user.role = "caretaker"
                user.save()

            caretaker, _ = Caretaker.objects.get_or_create(user=user)

            # Lista kratkih opisa na hrvatskom jeziku
            about_me_options = [
                "Studiram psihologiju i volim pomagati studentima s mentalnim zdravljem.",
                "Imam iskustvo u radu s mladima i strasno se zalažem za dobrobit studenata.",
                "Moja specijalizacija je klinička psihologija, a volim raditi na prevenciji stresa.",
                "Bavim se savjetovanjem i pružanjem podrške studentima u teškim trenucima.",
                "Volontiram u studentskim centrima i posvećen sam mentalnom zdravlju mladih.",
                "Imam dugogodišnje iskustvo u radu s akademskom populacijom.",
                "Studiram psihologiju i strastveno radim na projektima mentalnog zdravlja.",
                "Bavim se individualnim savjetovanjem i grupnim radionicama za studente.",
                "Posvećen sam pomoći studentima da prevaziđu izazove studiranja.",
                "Imam certifikat za pružanje emocionalne podrške i aktivno slušanje.",
            ]
            
            
            # Postavi about_me ako nije već postavljen
            if not caretaker.about_me:
                caretaker.about_me = random.choice(about_me_options)
            
            # Postavi caretaker kao odobrenog
            caretaker.approval_status = Caretaker.APPROVAL_APPROVED
            caretaker.is_approved = True
            
            # Dodaj sliku ako caretaker nema sliku
            if not caretaker.image:
                try:
                    # Check if S3 storage is properly configured
                    from django.conf import settings
                    s3_configured = all([
                        getattr(settings, 'AWS_ACCESS_KEY_ID', None),
                        getattr(settings, 'AWS_SECRET_ACCESS_KEY', None),
                        getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None),
                        getattr(settings, 'AWS_S3_ENDPOINT_URL', None),
                    ])
                    
                    if not s3_configured:
                        self.stdout.write(self.style.WARNING(
                            f"  Skipping image for {username}: S3 not fully configured "
                            "(missing B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, or B2_ENDPOINT)"
                        ))
                    else:
                        # Koristi pravatar.cc za random avatare (ima ~70 različitih slika)
                        img_num = (i % 70) + 1
                        img_url = f"https://i.pravatar.cc/300?img={img_num}"
                        response = requests.get(img_url, timeout=10)
                        
                        if response.status_code == 200:
                            # Spremi sliku kao ContentFile
                            img_content = ContentFile(response.content)
                            caretaker.image.save(
                                f"caretaker_{username}_{i}.jpg",
                                img_content,
                                save=False
                            )
                            self.stdout.write(self.style.SUCCESS(f"  Downloaded image for {username}"))
                        else:
                            self.stdout.write(self.style.WARNING(f"  Failed to download image for {username}: HTTP {response.status_code}"))
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"  Error downloading image for {username}: {e}"))

            # Optionally populate some caretaker fields if they exist
            try:
                if hasattr(caretaker, "tel_num") and not caretaker.tel_num:
                    caretaker.tel_num = f"+385{random.randint(900000000, 999999999)}"
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

        self.stdout.write(self.style.SUCCESS(f"Done. Created {created} caretakers, skipped {skipped} existing users."))
