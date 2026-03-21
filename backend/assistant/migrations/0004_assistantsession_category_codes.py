from django.db import migrations, models


LABEL_TO_CODE = {
    "stres i akademski pritisci": "1",
    "strah od ispita i loših ocjena": "1.1",
    "preopterećenost obavezama": "1.2",
    "problemi s organizacijom vremena i prokrastinacija": "1.3",
    "anksiozni poremećaji": "2",
    "generalizirani anksiozni poremećaj": "2.1",
    "socijalna anksioznost (strah od javnog nastupa, kontakta s profesorima/vršnjacima)": "2.2",
    "panični napadi": "2.3",
    "depresivni simptomi": "3",
    "tuga, gubitak interesa za aktivnosti": "3.1",
    "umor i demotivacija": "3.2",
    "nisko samopouzdanje i osjećaj bespomoćnosti": "3.3",
    "problemi u međuljudskim odnosima": "4",
    "sukobi s kolegama, prijateljima ili partnerima": "4.1",
    "problemi s komunikacijom i asertivnošću": "4.2",
    "osjećaj izolacije i usamljenosti": "4.3",
    "poremećaji spavanja": "5",
    "nesanicu ili nepravilne navike spavanja": "5.1",
    "posljedice kroničnog umora na koncentraciju i raspoloženje": "5.2",
    "problemi samopouzdanja i identiteta": "6",
    "sumnja u vlastite sposobnosti": "6.1",
    "nesigurnost u odabir studija ili karijere": "6.2",
    "osobni razvoj i pronalazak smisla": "6.3",
    "poremećaji prehrane i tjelesne slike": "7",
    "anoreksija": "7.1",
    "bulimija": "7.2",
    "prejedanje": "7.3",
    "negativna tjelesna slika i poremećena percepcija sebe": "7.4",
    "emocionalna regulacija i impulzivno ponašanje": "8",
    "nagli ispadi bijesa ili frustracije": "8.1",
    "problemi s kontrolom impulsa": "8.2",
    "ovisničko ponašanje (društvene mreže, kockanje, alkohol)": "8.3",
    "trauma i stresne životne situacije": "9",
    "gubitak bliske osobe": "9.1",
    "obiteljski problemi ili zlostavljanje": "9.2",
    "adaptacija na novi životni period (selidba, fakultet u drugom gradu)": "9.3",
    "seksualnost": "10",
    "propitivanje vlastite seksualnosti": "10.1",
    "anksioznost vezana za stupanje u spolne odnose": "10.2",
    "krizne situacije (rizik)": "11",
    "ostalo": "12",
}


def _normalize(value):
    return (value or "").strip().casefold()


def backfill_assistant_category_codes(apps, schema_editor):
    AssistantSession = apps.get_model("assistant", "AssistantSession")
    AssistantSessionSummary = apps.get_model("assistant", "AssistantSessionSummary")

    for model in (AssistantSession, AssistantSessionSummary):
        for obj in model.objects.all():
            main_code = LABEL_TO_CODE.get(_normalize(getattr(obj, "main_category", "")), "")
            sub_codes = [LABEL_TO_CODE.get(_normalize(label), "") for label in getattr(obj, "subcategories", [])]
            sub_codes = [code for code in sub_codes if code]
            obj.main_category_code = main_code
            obj.subcategory_codes = sub_codes
            obj.save(update_fields=["main_category_code", "subcategory_codes"])


class Migration(migrations.Migration):

    dependencies = [
        ("assistant", "0003_assistantsessionsummary_transcript_snapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="assistantsession",
            name="main_category_code",
            field=models.CharField(blank=True, default="", max_length=16),
        ),
        migrations.AddField(
            model_name="assistantsession",
            name="subcategory_codes",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="assistantsessionsummary",
            name="main_category_code",
            field=models.CharField(blank=True, default="", max_length=16),
        ),
        migrations.AddField(
            model_name="assistantsessionsummary",
            name="subcategory_codes",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(backfill_assistant_category_codes, migrations.RunPython.noop),
    ]
