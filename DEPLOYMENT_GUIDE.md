# CareFree Deployment Guide

Ovaj dokument je pisan za konkretan setup:

- frontend: Vercel
- backend: Railway
- source: tvoj GitHub fork

## Kratki odgovor prije svega

- Da, mozes deployati iz svog forka iako jos nisi pushao lokalne promjene.
- Repo moze ostati `private`; to ne smeta deployu ni normalnom koristenju aplikacije.
- Vercel Hobby je i dalje besplatan za osobne projekte.
- Railway vise nije "zauvijek potpuno besplatan" za ovakav backend. Trenutno ima trial/free model, ali nakon toga nije realno racunati na trajno potpuno besplatan production backend.

## Preporuceni redoslijed

1. Pushaj svoje lokalne promjene na svoj GitHub fork.
2. Deployaj backend na Railway.
3. Na Railwayju postavi Postgres bazu i sve backend env varijable.
4. Pokreni migracije.
5. Po potrebi seedaj demo korisnike i psihologe.
6. Deployaj frontend na Vercel.
7. Na Vercelu postavi frontend env varijable koje pokazuju na Railway backend.
8. Rucno prodji smoke test cijele aplikacije.

## 1. GitHub fork

Ako jos nisi spojio svoj fork kao `origin`, tipican redoslijed je:

```bash
git remote -v
git remote rename origin upstream
git remote add origin <URL-tvog-forka>
git push -u origin main
```

Ako vec imas svoj fork pod `origin`, samo:

```bash
git push -u origin main
```

## 2. Backend na Railway

### Kako deployati

1. Otvori Railway.
2. `New Project`.
3. `Deploy from GitHub repo`.
4. Spoji svoj GitHub account ako treba.
5. Odaberi svoj fork.
6. Kao root koristi repo root.
7. Railway ce koristiti root `Dockerfile`.

Root `Dockerfile` je sada prilagoden backend deployu iz ovog monorepa.

### Railway servisi koje trebas

U istom Railway projektu trebas:

- 1 web service za Django backend
- 1 PostgreSQL service

Opcionalno kasnije:

- Redis service ako zelis pravi Celery worker izvan eager moda

Za demo deploy mozes bez posebnog Redis workera ako ne ovisis o background workerima u runtimeu.

## 3. Backend env varijable na Railway

Minimalni obavezni backend env za demo deploy:

```env
APP_ENV=production
DEBUG=False
SECRET_KEY=<jak-random-secret>
ENCRYPTION_KEY=<stabilan-fernet-key>
FRONTEND_URL=https://<tvoj-vercel-domen>.vercel.app
ALLOWED_HOSTS=<tvoj-railway-backend-host>,.railway.app
CORS_ALLOWED_ORIGINS=https://<tvoj-vercel-domen>.vercel.app
CSRF_TRUSTED_ORIGINS=https://<tvoj-vercel-domen>.vercel.app,https://<tvoj-railway-backend-host>
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

### Baza

Kad dodas PostgreSQL service na Railway:

- Railway ce ti ponuditi `DATABASE_URL`
- tu vrijednost kopiraj u backend service env varijable kao `DATABASE_URL`

### AI

Ako zelis da Julija radi:

```env
OPENAI_API_KEY=<tvoj-openai-key>
AI_CONVERSATION_MODEL=gpt-5.2-chat-latest
AI_STRUCTURED_MODEL=gpt-5.2
AI_BACKUP_CONVERSATION_MODEL=gpt-4o-mini
```

### Email

Ako zelis stvarne mailove:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=<tvoj-resend-key>
DEFAULT_FROM_EMAIL=<verified-resend-from-email>
EMAIL_ASSETS_BASE_URL=https://<tvoj-vercel-domen>.vercel.app
```

`EMAIL_ASSETS_BASE_URL` je bitan da se slike u mailovima renderiraju s javno dostupne frontend domene.

### Google Calendar / Meet

Ako zelis booking + Meet flow:

```env
GOOGLE_CALENDAR_ID=<shared-calendar-id>
GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL=<shared-google-account-email>
GOOGLE_OAUTH_CLIENT_ID=<google-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<google-client-secret>
GOOGLE_OAUTH_REDIRECT_URI=https://<tvoj-railway-backend-host>/api/calendar/google/callback/
ENABLE_USER_GOOGLE_CALENDAR_SYNC=True
```

Napomena:

- nakon deploya i env setupa moras jos jednom spojiti shared Google account kroz backend flow
- bez toga Meet generacija nece biti pouzdana

### Storage / slike / uploadovi

Za ozbiljniji deploy preporuceno:

```env
USE_CLOUD_MEDIA=True
B2_KEY_ID=<backblaze-key-id>
B2_APPLICATION_KEY=<backblaze-app-key>
B2_BUCKET_NAME=<bucket>
B2_ENDPOINT=<endpoint>
B2_REGION=<region>
```

Ako ovo ne postavis:

- backend ce koristiti lokalni filesystem na Railwayju
- caretaker slike, CV-evi i diplome mogu nestati pri redeployu ili restartu

Za demo to moze kratkorocno proci, ali nije dobra dugorocna postavka.

## 4. Migrate i inicijalni backend setup

Nakon prvog deploya na Railwayju otvori service shell ili one-off command i pokreni:

```bash
python manage.py migrate
python manage.py create_superuser --email admin@carefree.com --password admin123 --first-name Admin --last-name User
python manage.py seed_help_categories
```

Ako zelis demo psihologe i demo studente:

```bash
python manage.py seed_demo_caretakers
```

Ako zelis manji demo seed:

```bash
python manage.py seed_demo_caretakers --count 6 --student-count 4
```

Seed sada:

- stvara demo psihologe sa slikama iz `demo_profiles/`
- stvara vise demo studenata
- generira lokalni snapshot credentiala u `generated/LOCAL_DEMO_CREDENTIALS.md`

Napomena:

- taj generirani credentials file je lokalno ignoriran u Git-u
- na Railwayju ga ne tretiraj kao trajni source of truth; tamo je vise korisno da seed command ispisuje accounte u logovima

## 5. Frontend na Vercel

### Kako deployati

1. Otvori Vercel.
2. `Add New Project`.
3. Importaj svoj GitHub fork.
4. Kao Root Directory odaberi `frontend`.
5. Framework bi trebao biti detektiran kao Next.js.

### Frontend env varijable na Vercelu

Obavezno postavi:

```env
NEXT_PUBLIC_BACKEND_URL=https://<tvoj-railway-backend-host>
NEXT_PUBLIC_API_URL=https://<tvoj-railway-backend-host>/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-client-id>
```

Nakon spremanja env varijabli napravi redeploy frontenda.

## 6. Povezivanje frontenda i backenda

Da bi cookie auth radio:

- frontend mora koristiti tocni Railway HTTPS backend URL
- backend mora imati tocni Vercel URL u:
  - `FRONTEND_URL`
  - `CORS_ALLOWED_ORIGINS`
  - `CSRF_TRUSTED_ORIGINS`
- production cookieji moraju ostati:
  - `SESSION_COOKIE_SECURE=True`
  - `CSRF_COOKIE_SECURE=True`
  - `SESSION_COOKIE_SAMESITE=None`
  - `CSRF_COOKIE_SAMESITE=None`

Ako promijenis Vercel domenu, azuriraj i backend env varijable.

## 7. Google login redirectovi

Ako koristis Google login:

- u Google Cloud Console dodaj Vercel domenu u allowed origins
- dodaj backend callback URL u redirect URI-je

Tipicno:

- frontend origin: `https://<tvoj-vercel-domen>.vercel.app`
- backend callback: `https://<tvoj-railway-backend-host>/api/calendar/google/callback/`

Takoder provjeri i auth flow koji koristi Google button na frontendu.

## 8. Sto s Dockerfileom

Za backend deploy na Railway:

- da, Dockerfile je bitan
- root `Dockerfile` je sada namjesten da:
  - cita `backend/requirements.txt`
  - kopira `backend/`
  - kopira `demo_profiles/`
  - starta `gunicorn`

Za frontend na Vercelu ti Dockerfile ne treba.

## 9. Sto nije realno "besplatno"

Vazno:

- Vercel Hobby je i dalje free za osobni projekt.
- Railway po trenutnim pravilima nije siguran izbor ako zelis trajno potpuno besplatno drzati backend online.
- Railway free/trial moze biti dovoljan za kratki demo period, ali ne bih obecavao "besplatno zauvijek".
- B2 ima mali free sloj, ali ovisi o stvarnoj potrosnji storagea i egressa.

Ako ti je cilj strogo 0 EUR dugorocno, ovaj stack nije idealan.

## 10. Preporuceni smoke test odmah nakon deploya

Prodji ovo redom:

1. Landing page se otvara.
2. Signup email request radi.
3. Login radi.
4. Student onboarding radi.
5. Caretaker login radi.
6. Search psihologa vraca rezultate sa slikama.
7. AI chat radi i moze zatvoriti sesiju.
8. Booking request prolazi.
9. Approve/reject radi.
10. Calendar obje strane radi.
11. Meet link se stvara.
12. Journal radi.
13. Feedback radi.
14. Emailovi prikazuju slike.

## 11. Moj pragmaticni savjet za tvoj slucaj

Ako zelis sto manje rizika za demo:

- backend deployaj na Railway
- frontend deployaj na Vercel
- koristi Railway Postgres
- koristi B2 za slike i dokumente
- koristi Resend za mailove
- seedaj manji broj demo psihologa i 3-4 demo studenta
- repo ostavi private

To je najcistiji put do brzog i dovoljno stabilnog demo okruzenja.
