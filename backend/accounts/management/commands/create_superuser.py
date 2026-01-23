from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction


class Command(BaseCommand):
    help = "Create a default superuser if it doesn't exist"

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            default="admin@carefree.com",
            help="Email for the superuser (default: admin@carefree.com)",
        )
        parser.add_argument(
            "--password",
            type=str,
            default="admin123",
            help="Password for the superuser (default: admin123)",
        )
        parser.add_argument(
            "--first-name",
            type=str,
            default="Admin",
            help="First name for the superuser (default: Admin)",
        )
        parser.add_argument(
            "--last-name",
            type=str,
            default="User",
            help="Last name for the superuser (default: User)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        
        email = options.get("email")
        password = options.get("password")
        first_name = options.get("first_name")
        last_name = options.get("last_name")

        # Check if superuser already exists
        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.WARNING(f"Superuser with email '{email}' already exists. Skipping.")
            )
            return

        try:
            # Create superuser
            user = User.objects.create_superuser(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n✓ Superuser created successfully!\n"
                    f"  Email: {email}\n"
                    f"  Password: {password}\n"
                    f"  Name: {first_name} {last_name}\n"
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Error creating superuser: {e}")
            )
