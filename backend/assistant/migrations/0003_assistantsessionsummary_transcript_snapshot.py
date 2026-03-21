from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assistant", "0002_assistantsession_flow_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="assistantsessionsummary",
            name="transcript_snapshot",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
