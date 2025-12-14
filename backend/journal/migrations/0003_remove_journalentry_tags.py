from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('journal', '0002_remove_journalentry_content_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='journalentry',
            name='tags',
        ),
    ]
