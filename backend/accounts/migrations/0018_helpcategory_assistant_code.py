from django.db import migrations, models
from django.utils.text import slugify


CATEGORY_TREE = (
    ("1", "Stres i akademski pritisci", (("1.1", "Strah od ispita i loših ocjena"), ("1.2", "Preopterećenost obavezama"), ("1.3", "Problemi s organizacijom vremena i prokrastinacija"))),
    ("2", "Anksiozni poremećaji", (("2.1", "Generalizirani anksiozni poremećaj"), ("2.2", "Socijalna anksioznost (strah od javnog nastupa, kontakta s profesorima/vršnjacima)"), ("2.3", "Panični napadi"))),
    ("3", "Depresivni simptomi", (("3.1", "Tuga, gubitak interesa za aktivnosti"), ("3.2", "Umor i demotivacija"), ("3.3", "Nisko samopouzdanje i osjećaj bespomoćnosti"))),
    ("4", "Problemi u međuljudskim odnosima", (("4.1", "Sukobi s kolegama, prijateljima ili partnerima"), ("4.2", "Problemi s komunikacijom i asertivnošću"), ("4.3", "Osjećaj izolacije i usamljenosti"))),
    ("5", "Poremećaji spavanja", (("5.1", "Nesanicu ili nepravilne navike spavanja"), ("5.2", "Posljedice kroničnog umora na koncentraciju i raspoloženje"))),
    ("6", "Problemi samopouzdanja i identiteta", (("6.1", "Sumnja u vlastite sposobnosti"), ("6.2", "Nesigurnost u odabir studija ili karijere"), ("6.3", "Osobni razvoj i pronalazak smisla"))),
    ("7", "Poremećaji prehrane i tjelesne slike", (("7.1", "Anoreksija"), ("7.2", "Bulimija"), ("7.3", "Prejedanje"), ("7.4", "Negativna tjelesna slika i poremećena percepcija sebe"))),
    ("8", "Emocionalna regulacija i impulzivno ponašanje", (("8.1", "Nagli ispadi bijesa ili frustracije"), ("8.2", "Problemi s kontrolom impulsa"), ("8.3", "Ovisničko ponašanje (društvene mreže, kockanje, alkohol)"))),
    ("9", "Trauma i stresne životne situacije", (("9.1", "Gubitak bliske osobe"), ("9.2", "Obiteljski problemi ili zlostavljanje"), ("9.3", "Adaptacija na novi životni period (selidba, fakultet u drugom gradu)"))),
    ("10", "Seksualnost", (("10.1", "Propitivanje vlastite seksualnosti"), ("10.2", "Anksioznost vezana za stupanje u spolne odnose"))),
    ("11", "KRIZNE SITUACIJE (RIZIK)", ()),
    ("12", "OSTALO", ()),
)


def assign_assistant_codes(apps, schema_editor):
    HelpCategory = apps.get_model("accounts", "HelpCategory")

    for root_code, root_label, children in CATEGORY_TREE:
        root = HelpCategory.objects.filter(label=root_label).first()
        if root is None:
            root = HelpCategory.objects.create(label=root_label, slug=slugify(root_label), assistant_code=root_code)
        else:
            root.parent = None
            if not root.slug:
                root.slug = slugify(root_label)
            root.assistant_code = root_code
            root.save(update_fields=["parent", "slug", "assistant_code"])

        for child_code, child_label in children:
            child = HelpCategory.objects.filter(label=child_label).first()
            if child is None:
                child = HelpCategory.objects.create(
                    label=child_label,
                    slug=slugify(child_label),
                    parent=root,
                    assistant_code=child_code,
                )
            else:
                child.parent = root
                if not child.slug:
                    child.slug = slugify(child_label)
                child.assistant_code = child_code
                child.save(update_fields=["parent", "slug", "assistant_code"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0017_caretaker_show_email_to_students_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="helpcategory",
            name="label",
            field=models.CharField(max_length=150, unique=True),
        ),
        migrations.AlterField(
            model_name="helpcategory",
            name="slug",
            field=models.SlugField(blank=True, max_length=150, unique=True),
        ),
        migrations.AddField(
            model_name="helpcategory",
            name="assistant_code",
            field=models.CharField(blank=True, max_length=16, null=True, unique=True),
        ),
        migrations.RunPython(assign_assistant_codes, migrations.RunPython.noop),
    ]
