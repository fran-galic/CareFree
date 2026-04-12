from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0019_alter_caretaker_tel_num_length"),
    ]

    operations = [
        migrations.AddField(
            model_name="caretaker",
            name="work_approach",
            field=models.CharField(
                blank=True,
                choices=[
                    ("cbt", "Kognitivno-bihevioralni pristup (KBT)"),
                    ("integrative", "Integrativni pristup"),
                    ("psychodynamic", "Psihodinamski pristup"),
                    ("humanistic", "Humanistički pristup"),
                    ("systemic", "Sistemski / obiteljski pristup"),
                    ("gestalt", "Gestalt pristup"),
                    ("act", "ACT"),
                    ("rebt", "REBT"),
                    ("dbt", "DBT"),
                ],
                max_length=32,
                null=True,
            ),
        ),
    ]
