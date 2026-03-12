# External Services Setup

Current status in this repo:
- `OpenAI` is configured in `backend/.env`.
- `Resend` is configured in `backend/.env`.
- `Shared Google Calendar` service account is configured in `backend/.env`.
- `Backblaze B2` is configured in `backend/.env`.
- `Google login` is the main remaining manual setup step.

## What the current Google login flow actually needs

The active flow does **not** require NextAuth.

It currently works like this:
1. Frontend uses `@react-oauth/google` to get a Google access token in the browser.
2. Frontend sends that token to `POST /api/accounts/google/`.
3. Backend verifies the token against Google userinfo and creates/logs in the user.

Because of that, the only required frontend env var for the current Google login button is:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_web_client_id
```

You do **not** need `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `NEXTAUTH_GOOGLE_ENABLED` unless you intentionally want to revive the separate NextAuth route.

## Google Cloud Console steps

Create a Google OAuth **Web application** credential and add these authorized JavaScript origins:

```text
http://localhost:3001
https://programsko-inzenjerstvo.vercel.app
```

If you deploy another frontend URL later, add that origin too.

Then copy the generated client ID into:

`frontend/.env.local`

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
```

## Local verification steps

1. Run backend readiness checks:

```bash
cd backend
source .venv/bin/activate
python manage.py check
python manage.py check_external_services
```

2. Start backend:

```bash
cd backend
source .venv/bin/activate
python manage.py runserver
```

3. Start frontend:

```bash
cd frontend
pnpm dev
```

4. Test Google login at:

```text
http://localhost:3001/accounts/login
```

Expected result:
- Google popup opens
- backend sets auth cookies
- existing onboarded user lands on `/carefree/main`
- new Google user lands on `/accounts/signup`

## Other configured external services

### Resend
- Provider is backend-managed through `send_project_email(...)`
- Relevant backend env:
  - `EMAIL_PROVIDER=resend`
  - `RESEND_API_KEY`
  - `DEFAULT_FROM_EMAIL`

### Shared Google Calendar
- Used for appointment events and Google Meet link generation
- Relevant backend env:
  - `GOOGLE_SERVICE_ACCOUNT_FILE` or `GOOGLE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_CALENDAR_ID`

Important:
- `GOOGLE_CALENDAR_ID` must be the shared calendar ID
- it must not be `primary`

### Backblaze B2
- Used for caretaker uploads and media files
- Relevant backend env:
  - `B2_KEY_ID`
  - `B2_APPLICATION_KEY`
  - `B2_BUCKET_NAME`
  - `B2_ENDPOINT`
  - `B2_REGION`

## Security note

Secrets are currently present in local env files and some were previously exposed in terminal history.

Before production or sharing logs:
- rotate the OpenAI API key
- rotate the Resend API key
- rotate the Backblaze B2 application key
