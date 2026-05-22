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
