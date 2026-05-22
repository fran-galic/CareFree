# Weekly Demo Reset

Ovaj dokument služi kao kratka operativna procedura za tjedni reset i ponovno punjenje CareFree demo okruženja prije testiranja sa studentima i psiholozima.

## Kada ovo koristiti

Koristi ovu proceduru kada želiš:

- isprazniti produkcijsku/demo bazu od starih testnih podataka
- ponovno generirati demo psihologe i demo studente
- ponovno napuniti zahtjeve, termine, feedback, AI sažetke i fake Meet linkove
- provjeriti da vanjski servisi i dalje rade

## Što ova procedura radi

Redoslijed naredbi radi sljedeće:

1. `flush`
- briše podatke iz baze
- ne briše tablice ni migracije

2. `migrate`
- provjerava i primjenjuje shemu baze

3. `seed_help_categories`
- puni kategorije pomoći

4. `seed_demo_caretakers --count 15 --student-count 4`
- stvara 15 demo psihologa
- stvara 4 demo studenta
- puni profile, slike, CV-eve, diplome i certifikate
- puni dostupnost
- puni pending zahtjeve, upcoming termine, completed termine, feedback
- puni kombinaciju običnih zahtjeva, AI sažetaka i transcripta
- upcoming seeded termini dobivaju fake realistične Meet linkove

5. `check`
- provjerava da je Django konfiguracija ispravna

6. `check_external_services`
- provjerava OpenAI
- provjerava e-mail provider
- provjerava shared Google Calendar credential
- provjerava B2 storage

## Razlika između `flush`, brisanja tablica i migracija

`flush`:

- briše podatke iz postojećih tablica
- ne briše same tablice
- ne briše migracije
- ne mijenja strukturu baze

To znači da nakon `flush`:

- shema baze i dalje postoji
- Django i dalje zna koje migracije postoje
- baza je samo ostala prazna

Brisanje tablica:

- uklanja stvarne tablice iz baze
- nakon toga aplikacija više nema gdje čitati i zapisivati podatke
- tada moraš ponovno stvoriti tablice kroz `migrate`

Brisanje migracija:

- briše Django migration datoteke iz koda
- to nije isto što i brisanje podataka
- to se ne radi za tjedni demo reset

Za tvoj slučaj gotovo uvijek želiš:

- `flush`
- pa `migrate`
- pa seed

Ne želiš:

- ručno brisati tablice
- ručno brisati migration datoteke

## Preduvjet

Prije ovog postupka backend treba biti redeployan na zadnji commit.

## Koraci

### 1. Spoji se na Railway shell

```bash
railway ssh
```

### 2. Pokreni reset i seed

U Railway shellu pokreni redom:

```bash
cd /app/backend
python manage.py flush --noinput
python manage.py migrate
python manage.py seed_help_categories
python manage.py seed_demo_caretakers --count 15 --student-count 4
python manage.py check
python manage.py check_external_services
```

### 3. Napravi admin korisnika ako treba

Ako nakon reseta želiš ponovno imati admin račun:

```bash
cd /app/backend
DJANGO_SUPERUSER_EMAIL=admin@carefree.local DJANGO_SUPERUSER_PASSWORD=AdminCareFree123! python manage.py createsuperuser --noinput
```

## Važna napomena za Google Calendar

`flush` briše i spremljeni shared Google OAuth credential iz baze.

To znači da je nakon reseta normalno da `check_external_services` prijavi:

- `Shared Google Calendar ... no SystemGoogleCredential is stored`

To nije bug. To samo znači da shared Google account treba ponovno spojiti.

## Kako ponovno spojiti shared Google Calendar

### 1. Otvori endpoint

U browseru otvori:

```text
https://carefree-production.up.railway.app/api/calendar/system/connect/
```

### 2. Uzmi `auth_url`

Endpoint će vratiti JSON s poljem `auth_url`.

Primjer:

```json
{"auth_url":"https://accounts.google.com/o/oauth2/auth/..."}
```

### 3. Otvori `auth_url` u browseru

### 4. Prijavi shared Google account

Prijavi se s:

```text
carefree.calendar1@gmail.com
```

### 5. Dovrši consent

Nakon toga backend će ponovno spremiti `SystemGoogleCredential` u bazu.

### 6. Provjeri da je credential vraćen

Vrati se u Railway shell i pokreni:

```bash
cd /app/backend
python manage.py check_external_services
```

Ispravan rezultat je da Shared Google Calendar više nije `MISS`, nego `OK`.

## Kako provjeriti je li seed stvarno uspio

Ako želiš kratku provjeru broja demo podataka:

```bash
cd /app/backend
python manage.py shell -c "from accounts.models import Caretaker, Student; from appointments.models import AppointmentRequest, Appointment, AppointmentFeedback; print({'caretakers': Caretaker.objects.filter(user__email__endswith='@demo.carefree.local').count(), 'students': Student.objects.filter(user__email__endswith='@demo.carefree.local').count(), 'requests': AppointmentRequest.objects.count(), 'appointments': Appointment.objects.count(), 'feedback': AppointmentFeedback.objects.count()})"
```

Očekivano je približno:

- `15` demo psihologa
- `4` demo studenta
- više desetaka requestova
- više desetaka termina
- više feedback zapisa

## Demo lozinke

Demo psiholozi:

```text
DemoPsiholog123!
```

Demo studenti:

```text
DemoStudent123!
```

Važno:

- svi seedani demo psiholozi koriste istu lozinku `DemoPsiholog123!`
- svi seedani demo studenti koriste istu lozinku `DemoStudent123!`
- popis seedanih e-mail adresa zapisuje se i u:

```text
generated/LOCAL_DEMO_CREDENTIALS.md
```

## Konkretni demo računi

Napomena:

- brojke ispod vrijede za čisti weekly reset odmah nakon `flush + migrate + seed_help_categories + seed_demo_caretakers`
- ako nakon toga ručno zakazuješ dodatne stvarne termine ili radiš dodatne testove, ove brojke se mogu promijeniti
- ovaj popis služi kao referenca za očekivano početno stanje demo okruženja

### Demo psiholozi

Svi koriste lozinku:

```text
DemoPsiholog123!
```

- `filip.horvat.01@demo.carefree.local`
  - 3 pending zahtjeva, 2 accepted zahtjeva, 1 rejected zahtjev
  - 1 completed termin, 1 feedback
  - 3 AI sažetka, 1 transcript, 1 fake Meet link
- `ivan.kovacevic.02@demo.carefree.local`
  - 3 pending zahtjeva, 2 accepted zahtjeva, 1 rejected zahtjev
  - 1 completed termin, 1 feedback
  - 4 AI sažetka, 1 transcript, 2 fake Meet linka
- `luka.babic.03@demo.carefree.local`
  - 3 pending zahtjeva, 2 accepted zahtjeva, 1 rejected zahtjev
  - 1 completed termin, 1 feedback
  - 2 AI sažetka, 1 transcript, 1 fake Meet link
- `ana.maric.04@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva, 1 rejected zahtjev
  - 1 completed termin, bez feedbacka
  - 3 AI sažetka, 1 transcript, 2 fake Meet linka
- `petra.peric.05@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva, 1 rejected zahtjev
  - 1 completed termin, 1 feedback
  - 2 AI sažetka, 1 transcript, bez fake Meet linka
- `iva.novak.06@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva, 1 rejected zahtjev
  - 1 completed termin, 1 feedback
  - 2 AI sažetka, 2 transcripta, 2 fake Meet linka
- `marija.bozic.07@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva
  - 1 completed termin, 1 feedback
  - 2 AI sažetka, 1 transcript, 1 fake Meet link
- `katarina.juric.08@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva
  - 1 completed termin, bez feedbacka
  - 2 AI sažetka, 1 transcript, 2 fake Meet linka
- `lucija.knezevic.09@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva
  - 1 completed termin, 1 feedback
  - 1 AI sažetak, 1 transcript, 1 fake Meet link
- `ivana.tomic.10@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva
  - 1 completed termin, 1 feedback
  - 2 AI sažetka, 1 transcript, 1 fake Meet link
- `matea.pavlovic.11@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva
  - 1 completed termin, 1 feedback
  - 2 AI sažetka, 1 transcript, 1 fake Meet link
- `tea.milic.12@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva
  - 1 completed termin, bez feedbacka
  - 1 AI sažetak, 1 transcript, 2 fake Meet linka
- `nika.grgic.13@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva
  - 1 completed termin, 1 feedback
  - 2 AI sažetka, 1 transcript, 1 fake Meet link
- `tena.lovric.14@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva
  - 1 completed termin, 1 feedback
  - 2 AI sažetka, 1 transcript, 2 fake Meet linka
- `dora.blazevic.15@demo.carefree.local`
  - 1 pending zahtjev, 2 accepted zahtjeva
  - 1 completed termin, 1 feedback
  - 1 AI sažetak, 1 transcript, bez fake Meet linka

### Demo studenti

Svi koriste lozinku:

```text
DemoStudent123!
```

- `demo.student@carefree.local`
  - 14 requestova ukupno
  - 5 pending, 7 accepted, 2 rejected
  - 4 completed termina, 4 feedback zapisa
  - 9 AI sažetaka, 4 transcripta, 3 fake Meet linka
- `ivan.student@carefree.local`
  - 14 requestova ukupno
  - 5 pending, 8 accepted, 1 rejected
  - 4 completed termina, 4 feedback zapisa
  - 9 AI sažetaka, 2 transcripta, 3 fake Meet linka
- `lea.student@carefree.local`
  - 13 requestova ukupno
  - 5 pending, 7 accepted, 1 rejected
  - 3 completed termina, bez feedbacka
  - 6 AI sažetaka, 5 transcripta, 6 fake Meet linkova
- `petra.student@carefree.local`
  - 16 requestova ukupno
  - 6 pending, 8 accepted, 2 rejected
  - 4 completed termina, 4 feedback zapisa
  - 7 AI sažetaka, 5 transcripta, 7 fake Meet linkova

## Što seed točno ugradi u demo profile

### Svi demo psiholozi

Svaki seedani demo psiholog dobiva:

- profil
- profilnu sliku
- `about me`
- broj telefona
- kategorije pomoći
- opcionalni `pristup u radu`
- CV
- barem jednu diplomu
- po potrebi i certifikate
- availability za naredna 2 tjedna
- `1` upcoming accepted zahtjev s terminom
- `1` completed termin iz prošlosti

### Dodatna raspodjela po psiholozima

Seed dodatno raspoređuje aktivnosti ovako:

- prva `3` psihologa dobivaju po `3` pending zahtjeva
- ostalih `12` psihologa dobiva po `1` pending zahtjev
- prvih `6` psihologa dobiva i po `1` rejected zahtjev
- `12` od `15` psihologa dobiva feedback na prošli completed termin
- `3` od `15` psihologa ostaje bez feedbacka na prošli termin da se vidi i taj scenarij

### AI kontekst u zahtjevima

Nisu svi zahtjevi isti. Seed miješa više scenarija:

- dio zahtjeva ima samo ručno napisani razlog dolaska
- dio zahtjeva ima `AI sažetak`
- dio zahtjeva ima `AI sažetak + transcript`

To je namjerno kako bi UI pokazivao različite kombinacije stvarnog korištenja.

### Seedani upcoming termini

Za upcoming termine seed radi sljedeće:

- svi psiholozi dobivaju po `1` upcoming appointment
- većina upcoming termina ima fake Meet link
- manji dio upcoming termina namjerno ostaje u stanju bez linka / `sync_failed` da se vidi i taj fallback scenarij

### Completed termini

Za completed termine seed radi sljedeće:

- svi psiholozi dobivaju po `1` completed termin
- dio completed termina ima feedback
- dio completed termina ima i fake Meet link

### Demo studenti

Seed stvara `4` demo studenta.

Oni nemaju potpuno simetrične profile aktivnosti, nego dijele zahtjeve i termine kroz više psihologa kako bi:

- student dashboard izgledao živo
- kalendar imao upcoming i prošle termine
- booking/request history imao više statusa
- psiholozi vidjeli različite kombinacije podataka

U praksi to znači da će 2-3 demo studenta izgledati bogatije popunjeno od ostalih, što je namjerno i dobro za evaluaciju.

## Što nakon toga još ručno provjeriti

Nakon reseta i reconnecta preporučeno je ručno provjeriti:

1. login studenta
2. login psihologa
3. student search psihologa
4. psiholog incoming requestove
5. student calendar
6. psychologist calendar
7. jedan stvarni testni booking ako želiš provjeriti pravi Google Meet

## Razlika između seedanih i stvarnih Meet linkova

Seedani upcoming termini koriste fake, ali realistične Meet linkove radi prikaza u UI-u.

Pravi Google Meet linkovi nastaju samo kada:

- student i psiholog stvarno zakažu termin kroz aplikaciju
- shared Google Calendar credential je aktivan

## Kada je postupak završen

Možeš smatrati da je demo okruženje spremno kada vrijedi sve sljedeće:

- seed je završio bez tracebacka
- `python manage.py check` prolazi
- `python manage.py check_external_services` javlja `OK` i za Shared Google Calendar
- možeš se prijaviti kao demo student i demo psiholog
- vidiš popunjene requestove, termine, feedback i AI kontekst
