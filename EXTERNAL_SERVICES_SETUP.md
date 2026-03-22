# External Services Setup

Ovaj dokument opisuje stvarni setup koji repo trenutno koristi.

## 1. OpenAI

Koristi se za Julija assistant flow.

Obavezni backend env:

```env
OPENAI_API_KEY=
AI_CONVERSATION_MODEL=gpt-5.2-chat-latest
AI_STRUCTURED_MODEL=gpt-5.2
AI_BACKUP_CONVERSATION_MODEL=gpt-4o-mini
```

Bez `OPENAI_API_KEY`:

- assistant endpointi postoje
- ali AI generiranje neće raditi

## 2. Email

Repo podržava dva moda:

- `EMAIL_PROVIDER=resend` kao primarni path
- SMTP fallback

### Resend

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=
DEFAULT_FROM_EMAIL=
FRONTEND_URL=http://localhost:3001
```

### SMTP fallback

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=
```

## 3. Shared Google Calendar / Google Meet

Trenutni preferirani setup je shared OAuth account, ne per-user NextAuth i ne isključivo service account.

### Obavezno

```env
GOOGLE_CALENDAR_ID=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL=
ENABLE_USER_GOOGLE_CALENDAR_SYNC=True
```

Napomene:

- `GOOGLE_CALENDAR_ID` mora biti shared calendar ID
- ne smije biti `primary`
- `GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL` treba biti Google račun kojim autorizirate shared kalendar

### Bootstrap shared credentiala

1. Pokreni backend.
2. Otvori:

```text
GET /api/calendar/system/connect/
```

3. Autoriziraj shared Google account.
4. Callback sprema `SystemGoogleCredential` u bazu.
5. Provjeri stanje na:

```text
GET /api/calendar/shared-status/
```

### Važno nakon DB reseta

Ako resetiraš lokalnu bazu:

- `SystemGoogleCredential` nestaje
- shared status postaje disconnected
- Meet generation može prestati raditi

Tada ponovno spoji account preko `/api/calendar/system/connect/`.

### Fallback service account path

Ako ne koristiš shared OAuth account, backend i dalje podržava service account:

```env
GOOGLE_SERVICE_ACCOUNT_FILE=
```

ili

```env
GOOGLE_SERVICE_ACCOUNT_JSON=
```

To je fallback, ne više jedini očekivani setup.

## 4. Google login

Aktivni login flow ne ovisi o NextAuth.

Trenutni flow:

1. Frontend koristi `@react-oauth/google`.
2. Browser dobije Google access token.
3. Frontend ga šalje na `POST /api/accounts/google/`.
4. Backend provjeri userinfo i kreira / logira korisnika.

Frontend env:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

Ne trebaju ti `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ni `NEXTAUTH_GOOGLE_ENABLED` osim ako svjesno želiš reaktivirati zaseban NextAuth path koji danas nije primarni.

## 5. Backblaze B2

Koristi se za caretaker uploadove i media kad je `USE_CLOUD_MEDIA=True`.

```env
B2_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_NAME=
B2_ENDPOINT=
B2_REGION=
USE_CLOUD_MEDIA=True
```

Ako `USE_CLOUD_MEDIA=False`, backend lokalno koristi `backend/media/`.

## 6. Journal encryption

Za produkciju obavezno postavi:

```env
ENCRYPTION_KEY=
```

To mora biti stabilan Fernet key. Ne smije se mijenjati bez planirane rotacije.

## 7. Readiness check

Repo već ima sigurni readiness check bez ispisivanja tajni:

```bash
cd backend
./.venv/bin/python manage.py check_external_services
```

Provjerava:

- OpenAI
- email
- shared Google Calendar
- Backblaze B2

## 8. Security pravila

Nikad ne committaj:

- `.env`
- credential JSON datoteke
- API ključeve
- privatne OAuth secret-e
- privatne certifikate

Prije deploya ili dijeljenja logova obavezno rotiraj sve ranije kompromitirane ključeve.
