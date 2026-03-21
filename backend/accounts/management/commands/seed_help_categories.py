from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from accounts.models import HelpCategory
from assistant.category_codes import CATEGORY_TREE


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

        created = 0
        existed = 0

        for root_node in CATEGORY_TREE:
            root_defaults = {"slug": slugify(root_node.label), "assistant_code": root_node.code}
            root, root_created = HelpCategory.objects.get_or_create(
                label=root_node.label, defaults=root_defaults
            )
            if root.assistant_code != root_node.code:
                root.assistant_code = root_node.code
                root.save(update_fields=["assistant_code"])
            if root_created:
                created += 1
            else:
                existed += 1

            for child_node in root_node.children:
                sub_defaults = {"slug": slugify(child_node.label), "assistant_code": child_node.code}
                subcat, sub_created = HelpCategory.objects.get_or_create(
                    label=child_node.label, parent=root, defaults=sub_defaults
                )
                if subcat.assistant_code != child_node.code:
                    subcat.assistant_code = child_node.code
                    subcat.save(update_fields=["assistant_code"])
                if sub_created:
                    created += 1
                else:
                    existed += 1

        self.stdout.write(self.style.SUCCESS(f"Done. Created {created} categories, {existed} already existed."))
