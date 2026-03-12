from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0016_alter_caretaker_image_alter_caretakercv_file_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="caretaker",
            name="show_email_to_students",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="caretaker",
            name="show_phone_to_students",
            field=models.BooleanField(default=False),
        ),
    ]
