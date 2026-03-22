# CareFree Demo Handoff

Ovaj dokument je namijenjen brzom dijeljenju pristupa i osnovnih operativnih uputa za demo instancu.

Bitno:

- dokument sadrži demo i admin credentiale
- drži repo privatnim
- ako promijeniš seed passworde ili broj demo profila, ažuriraj i ovaj dokument

## Linkovi

- frontend: `https://carefree-mu.vercel.app`
- backend: `https://carefree-production.up.railway.app`
- admin: `https://carefree-production.up.railway.app/admin/login/`
- OpenAPI schema: `https://carefree-production.up.railway.app/schema/`

## Admin

- email: `admin@carefree.com`
- password: `admin123`

## Demo Caretakers

Svi demo psiholozi koriste istu lozinku:

- password: `DemoPsiholog123!`

Računi:

- `filip.horvat.01@demo.carefree.local` | Filip Horvat
- `ivan.kovacevic.02@demo.carefree.local` | Ivan Kovačević
- `luka.babic.03@demo.carefree.local` | Luka Babić
- `ana.maric.04@demo.carefree.local` | Ana Marić
- `petra.peric.05@demo.carefree.local` | Petra Perić
- `iva.novak.06@demo.carefree.local` | Iva Novak
- `marija.bozic.07@demo.carefree.local` | Marija Božić
- `katarina.juric.08@demo.carefree.local` | Katarina Jurić
- `lucija.knezevic.09@demo.carefree.local` | Lucija Knežević
- `ivana.tomic.10@demo.carefree.local` | Ivana Tomić
- `matea.pavlovic.11@demo.carefree.local` | Matea Pavlović
- `tea.milic.12@demo.carefree.local` | Tea Milić
- `nika.grgic.13@demo.carefree.local` | Nika Grgić
- `tena.lovric.14@demo.carefree.local` | Tena Lovrić
- `dora.blazevic.15@demo.carefree.local` | Dora Blažević

## Demo Students

Svi demo studenti koriste istu lozinku:

- password: `DemoStudent123!`

Računi:

- `demo.student@carefree.local` | Demo Student | FER | godina 3
- `lea.student@carefree.local` | Lea Student | FFZG | godina 2
- `ivan.student@carefree.local` | Ivan Student | TVZ | godina 4
- `petra.student@carefree.local` | Petra Student | PMF | godina 5

## Jesu li demo mailovi uvijek isti?

Da, dok god vrijedi sve ovo:

- seed se vrti nad istim `demo_profiles/` slikama
- redoslijed slika ostane isti
- seed koristi iste default passworde
- ne mijenja se logika imenovanja u `seed_demo_caretakers`

Drugim riječima:

- emailovi i shared passwordi su stabilni
- ako promijeniš seed kod ili slike, mogu se promijeniti

## Trebaš li dirati bazu?

Ne za normalno korištenje.

Bazu trebaš dirati samo ako želiš:

- full reset demo sustava
- obrisati sve demo korisnike i ponovno ih generirati
- krenuti od potpuno čistog stanja

Za normalni demo flow:

- ne diraj bazu
- koristi aplikaciju normalno

## Koliko može koštati?

Ovo je gruba procjena za mali demo/projekt i ovisi o stvarnom prometu.

Fiksni ili gotovo fiksni dio:

- Vercel Hobby: tipično `0 USD` za mali privatni demo
- Railway: po službenoj pricing stranici postoji `Free` s trial kreditima, pa zatim `1 USD/mj`, a `Hobby` kreće od `5 USD` minimalne mjesečne potrošnje
- Resend: `0 USD` dok si unutar free limita
- Backblaze B2: obično par centi ili manje za ovakav mali demo

Varijabilni dio:

- OpenAI: ovisi o broju AI razgovora; za mali demo može biti vrlo malo, ali ako više ljudi aktivno koristi Juliju, to postaje glavni varijabilni trošak

Praktično očekivanje za mali studentski demo:

- vrlo često ukupno završiš otprilike u rangu `1 do 10 USD/mj`
- ako si na Railway Hobby i koristiš AI malo češće, realnije je `5 do 20 USD/mj`
- ako AI usage poraste, OpenAI može vrlo brzo postati najveći trošak

Korisni pricing linkovi:

- Vercel pricing: `https://vercel.com/pricing`
- Railway pricing: `https://railway.com/pricing`
- Resend pricing: `https://resend.com/pricing`
- Backblaze B2 pricing: `https://www.backblaze.com/cloud-storage/pricing`
- OpenAI pricing: `https://openai.com/api/pricing`

Napomena:

- ove cijene mogu se promijeniti
- provjerene su 22. ožujka 2026.

## Kako napraviti full reset sustava?

Ako želiš obrisati sve korisnike, demo psihologe, demo studente, slike, diplome, CV-eve i certifikate, najčišći put je:

### Varijanta A: pravi clean reset

1. obriši Railway Postgres service
2. napravi novi Railway Postgres service
3. ako želiš i čist media storage:
   - isprazni B2 bucket
   - ili napravi novi prazan B2 bucket i promijeni env varijable
4. redeploy backend
5. ponovno pokreni:

```bash
python manage.py migrate
python manage.py create_superuser --email admin@carefree.com --password admin123 --first-name Admin --last-name User
python manage.py seed_help_categories
python manage.py seed_demo_caretakers --student-count 4
python manage.py check_external_services
```

6. ako si napravio novu praznu bazu, shared Google Calendar treba ponovno spojiti

To je jedini stvarno čisti reset.

### Točan rebuild redoslijed nakon clean reset-a

Ako želiš da se sustav vrati na isto demo stanje, sa istim admin računom i istim shared demo lozinkama, nakon čistog reset-a pokreni točno ovaj redoslijed:

```bash
python manage.py migrate
python manage.py create_superuser --email admin@carefree.com --password admin123 --first-name Admin --last-name User
python manage.py seed_help_categories
python manage.py seed_demo_caretakers --student-count 4
python manage.py check_external_services
```

Što time dobiješ:

- admin:
  - email `admin@carefree.com`
  - password `admin123`
- svi demo caretakers opet dobiju shared lozinku:
  - `DemoPsiholog123!`
- svi demo studenti opet dobiju shared lozinku:
  - `DemoStudent123!`
- demo mailovi ostanu isti ako se ne promijene seed logika i `demo_profiles/` slike

Bitna napomena:

- nakon čistog reset-a baze shared Google credential više neće biti u DB-u
- zato nakon ovih komandi treba ponovno spojiti shared Google account
- bez toga booking može i dalje raditi djelomično, ali Google Meet / shared calendar flow neće biti potpuno spreman

## Ako želiš uvijek iste demo račune i iste lozinke

Da, možeš to održavati stabilnim.

To će ostati isto dok god ne promijeniš:

- `seed_demo_caretakers` logiku
- default seed passworde
- popis i redoslijed `demo_profiles/` slika
- `DEMO_STUDENT_PROFILES`

Drugim riječima:

- admin može ostati isti
- demo caretakeri mogu ostati isti
- demo studenti mogu ostati isti
- lozinke mogu ostati iste

Ako samo resetiraš bazu i ponovno pokreneš gore navedene komande, dobit ćeš natrag isto demo stanje.

### Varijanta B: reset samo podataka u bazi

Možeš obrisati i ponovno seedati bazu, ali ako koristiš B2:

- stari media fileovi mogu ostati u bucketu kao orphaned fileovi
- aplikacija ih više neće referencirati iz baze, ali će fizički ostati u storageu

Zato:

- za stvarno čisto stanje resetiraj i DB i B2

## Ako želiš samo osvježiti demo korisnike

Najjednostavnije:

```bash
python manage.py seed_demo_caretakers --student-count 4
```

To će:

- updateati postojeće demo korisnike
- zadržati isti naming pattern
- ukloniti stale demo usere koji više ne odgovaraju trenutnom seed snapshotu

To znači da su i mailovi normalno stabilni, sve dok se ne promijeni seed input.

## Gdje su slike i dokumenti?

Ako je `USE_CLOUD_MEDIA=True`, tada idu u B2.

Tipični media pathovi su:

- `caretakers/images/`
- `caretakers/cvs/`
- `caretakers/diplomas/`
- `caretakers/certificates/`

Ako radiš full reset i želiš baš sve počistiti, očisti i te objekte u bucketu ili koristi novi bucket.
