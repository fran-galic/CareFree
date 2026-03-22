# CareFree

CareFree je web aplikacija za studentsku psihološku podršku. Kombinira:

- AI asistenticu Juliju za inicijalni razgovor, strukturiranje problema i preporuku psihologa
- pretragu i pregled odobrenih psihologa
- zahtjeve za termine, odobravanje, kalendar i Google Meet poveznice
- vođenje dnevnika
- privatni post-session feedback između studenta i psihologa

Repo je monorepo s:

- `backend/` - Django REST API
- `frontend/` - Next.js aplikacija
- `scripts/` - lokalni reset i demo seed
- `demo_profiles/` - seed asseti za demo psihologe

## Status projekta

Projekt je u kasnoj fazi poliranja. Glavni korisnički tokovi su implementirani i testirani:

- registracija i prijava
- student i caretaker onboarding
- Google login kao opcionalni auth path
- AI assistant session flow sa summaryjima i recommendation flowom
- search i public profile psihologa
- request -> approve/reject -> appointment flow
- shared Google Calendar / Google Meet integracija
- student i caretaker kalendar
- caretaker availability grid
- journal s enkripcijom sadržaja
- post-session feedback

Najveći preostali posao:

- dodatni hardening AI flowa
- puni end-to-end QA
- završni production setup

## Arhitektura

### Backend

Stack:

- Python 3.12
- Django 5
- Django REST Framework
- SimpleJWT + cookie auth
- Celery
- OpenAI Python SDK
- Google Calendar API
- Backblaze B2 preko `django-storages`

Glavne Django aplikacije:

- `accounts` - auth, onboarding, caretaker uploads, Google login
- `users` - profilni endpointi, kategorije pomoći, search
- `assistant` - AI razgovor, summaries, recommendation matching, crisis mode
- `appointments` - requests, appointments, holds, feedback, availability
- `calendar_integration` - shared Google OAuth i Calendar/Meet integracija
- `journal` - enkriptirani dnevnik

### Frontend

Stack:

- Next.js 16
- React 19
- SWR
- Tailwind CSS 4
- React Big Calendar

Glavne stranice:

- `/accounts/*` - auth i onboarding
- `/carefree/main` - dashboard po ulozi
- `/carefree/messages` - Julija AI chat
- `/carefree/search` - search psihologa
- `/carefree/caretaker/[id]` - javni profil + booking
- `/carefree/calendar` - kalendar termina
- `/carefree/dostupnost` - caretaker availability grid
- `/carefree/requests` - caretaker request inbox
- `/carefree/journal` - dnevnik

## Lokalni setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Kreiraj `backend/.env` po primjeru iz `backend/.env.example`.

Pokreni migracije:

```bash
python manage.py migrate
```

Pokreni backend:

```bash
python manage.py runserver
```

### 2. Frontend

```bash
cd frontend
pnpm install
```

Kreiraj `frontend/.env.local` po primjeru iz `frontend/.env.example`.

Pokreni frontend:

```bash
pnpm dev
```

Frontend se lokalno vrti na `http://localhost:3001`.

## Minimalni env setup

### Backend obavezno

Za lokalni razvoj bez vanjskih servisa dovoljno je:

```env
APP_ENV=development
SECRET_KEY=change-me
DEBUG=True
FRONTEND_URL=http://localhost:3001
```

Napomene:

- SQLite se koristi ako `DATABASE_URL` nije postavljen.
- U `DEBUG=True` modu Celery taskovi se izvršavaju eager/sinkrono.
- Ako `ENCRYPTION_KEY` nije postavljen u debug modu, backend generira privremeni ključ. To je prihvatljivo samo lokalno.
- Lokalni cookieji defaultno koriste `SameSite=Lax` i nisu `Secure`, upravo da auth radi na `localhost`.

### Backend za puni feature set

Za kompletan lokalni ili produkcijski setup relevantni su još:

```env
OPENAI_API_KEY=
EMAIL_PROVIDER=resend
RESEND_API_KEY=
DEFAULT_FROM_EMAIL=

GOOGLE_CALENDAR_ID=
GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=

B2_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_NAME=
B2_ENDPOINT=
B2_REGION=
USE_CLOUD_MEDIA=False

ENCRYPTION_KEY=
```

## Production konfiguracija

Backend je sada pripremljen za jasan prijelaz na production preko env varijabli.

Minimalni sigurni production setup:

```env
APP_ENV=production
DEBUG=False
SECRET_KEY=<dugacak-random-secret>
ENCRYPTION_KEY=<stabilan-fernet-kljuc>
FRONTEND_URL=https://your-frontend-domain.com
ALLOWED_HOSTS=your-backend-domain.com,.railway.app
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
CSRF_TRUSTED_ORIGINS=https://your-frontend-domain.com,https://your-backend-domain.com
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SESSION_COOKIE_SAMESITE=None
CSRF_COOKIE_SAMESITE=None
SECURE_SSL_REDIRECT=True
USE_X_FORWARDED_PROTO=True
USE_X_FORWARDED_HOST=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
```

Važne napomene:

- U productionu backend sada faila pri startu ako `SECRET_KEY` nije dovoljno jak.
- U productionu backend sada faila pri startu ako `ENCRYPTION_KEY` nije postavljen.
- Cookie postavke su centralizirane kroz Django settings, pa auth viewevi više ne ovise o ručnom grananju po `DEBUG`.
- Ako su frontend i backend na različitim domenama, za cross-site cookie auth treba ostaviti `SameSite=None` i `Secure=True`.
- Ako HTTPS redirect već radi na reverse proxyju, `SECURE_SSL_REDIRECT` se i dalje može ostaviti uključenim; bitno je da je `USE_X_FORWARDED_PROTO=True` iza Railwayja ili sličnog proxya.

### Frontend obavezno

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

## Vanjski servisi

### OpenAI

Koristi se za:

- Julija conversation flow
- structured AI result
- summary generation

Bez `OPENAI_API_KEY` assistant neće raditi.

### Email

Backend podržava:

- Resend kao primarni providera
- SMTP fallback

### Google Calendar / Google Meet

Aplikacija koristi shared Google calendar pristup.

Aktivni preferirani put:

- postavljen `GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL`
- spremljen `SystemGoogleCredential` kroz `/api/calendar/system/connect/`

Fallback put:

- service account preko `GOOGLE_SERVICE_ACCOUNT_FILE` ili `GOOGLE_SERVICE_ACCOUNT_JSON`

Napomena:

- `GOOGLE_CALENDAR_ID` mora biti stvarni shared calendar ID
- ne smije biti `primary`

### Backblaze B2

Koristi se za caretaker uploads i media u cloudu kad je `USE_CLOUD_MEDIA=True`.

## Demo podaci i reset

Puni lokalni reset:

```bash
bash scripts/reset_local_app.sh
```

To radi:

- briše lokalnu SQLite bazu
- briše lokalni `backend/media`
- pokreće migracije
- seeda help kategorije
- kreira default admina

Default admin:

- email: `admin@carefree.com`
- password: `admin123`

Seed demo psihologa i demo studenta:

```bash
bash scripts/seed_demo_caretakers.sh
```

Seed koristi slike iz `demo_profiles/`, generira odobrene profile, dostupnost i demo feedback primjere.

## Testovi

### Backend

```bash
cd backend
./.venv/bin/python manage.py test
```

Trenutno stanje:

- 35 backend testova
- svi prolaze

### Frontend

```bash
cd frontend
pnpm test -- --runInBand
```

Trenutno stanje:

- 6 frontend testova
- svi prolaze

## Korisni endpointi

### Assistant

- `POST /assistant/session/start`
- `POST /assistant/session/message`
- `POST /assistant/session/end`
- `GET /assistant/summaries`
- `GET /assistant/summaries/<id>`

### Appointments

- `POST /api/appointments/request/`
- `GET /api/appointments/student/requests/`
- `GET /api/appointments/caretaker/requests/`
- `POST /api/appointments/caretaker/requests/<id>/approve/`
- `POST /api/appointments/caretaker/requests/<id>/reject/`
- `GET /api/appointments/calendar/my/`
- `GET /api/appointments/caretaker/slots/`
- `POST /api/appointments/holds/`
- `POST /api/appointments/holds/<id>/release/`
- `GET /api/appointments/student/feedback/pending/`
- `POST /api/appointments/<id>/feedback/`

### Calendar

- `GET /api/calendar/shared-status/`
- `GET /api/calendar/system/connect/`
- `GET /api/calendar/oauth/callback/`

### Auth / profiles

- `POST /auth/login/`
- `POST /auth/logout/`
- `POST /auth/google/`
- `POST /auth/register/request-email/`
- `POST /auth/register/confirm/`
- `POST /auth/register/student/`
- `GET|POST|PATCH /auth/caretaker/register/`
- `POST /auth/caretaker/cv/`
- `POST /auth/caretaker/diploma/`
- `POST /auth/caretaker/certificate/`
- `POST /auth/caretaker/image/`
- `GET /users/me/`
- `GET /users/caretakers/help-categories/`
- `GET /users/caretakers/search/`

## Deployment checklist

- postaviti produkcijski `SECRET_KEY`
- postaviti stabilan `ENCRYPTION_KEY`
- konfigurirati `DATABASE_URL`
- konfigurirati `FRONTEND_URL`, CORS i CSRF trusted origins
- konfigurirati mail provider
- konfigurirati OpenAI
- konfigurirati shared Google Calendar credential
- konfigurirati B2 ako se koristi cloud media
- osigurati static/media hosting strategiju
- proći puni QA svih glavnih flowova

## Git higijena

U Git ne smiju ići:

- `.env` datoteke
- virtualna okruženja
- `node_modules`, `.next`, coverage i build output
- lokalne baze i media
- IDE metadata
- tajni ključevi, credential JSON, privatni certifikati
- radni screenshotovi i privremeni asseti koji se ne koriste u aplikaciji

Repo je očišćen upravo u tom smjeru. Ako uvodiš novu integraciju, prvo dodaj pravila u `.gitignore`, pa tek onda kreiraj lokalne datoteke.
