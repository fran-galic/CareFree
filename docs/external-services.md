# External Services

CareFree can run locally with only Django, SQLite and the frontend. The full product experience uses external services for AI, email, calendar/Meet links and media storage.

## OpenAI

Used by:

- Julija assistant conversation flow
- structured JSON assistant results
- session summaries and category extraction
- journal safety classification

Backend environment:

```env
OPENAI_API_KEY=
AI_CONVERSATION_MODEL=
AI_BACKUP_CONVERSATION_MODEL=
```

If `OPENAI_API_KEY` is not configured, model-backed AI generation is unavailable. Some local fallback behavior still exists in the assistant code, but it should not be treated as the complete assistant experience.

## Email

The backend supports:

- Resend through `EMAIL_PROVIDER=resend`
- SMTP fallback

Resend:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=
DEFAULT_FROM_EMAIL=
EMAIL_ASSETS_BASE_URL=
```

SMTP fallback:

```env
EMAIL_HOST=
EMAIL_PORT=
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=
```

## Google Calendar And Meet

The preferred integration is a shared Google OAuth account connected to a shared calendar.

Backend environment:

```env
GOOGLE_CALENDAR_ID=
GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
ENABLE_USER_GOOGLE_CALENDAR_SYNC=True
```

Important details:

- `GOOGLE_CALENDAR_ID` must be the shared calendar ID, not `primary`.
- `GOOGLE_OAUTH_REDIRECT_URI` should point to `/api/calendar/oauth/callback/`.
- After database resets, the stored `SystemGoogleCredential` is removed and the shared account must be connected again.

Connect:

```text
GET /api/calendar/system/connect/
```

Check status:

```text
GET /api/calendar/shared-status/
```

The backend also contains a service-account fallback through `GOOGLE_SERVICE_ACCOUNT_FILE` or `GOOGLE_SERVICE_ACCOUNT_JSON`, but the shared OAuth path is the main documented path.

## Google Login

The frontend uses `@react-oauth/google` and sends the received token to the backend login endpoint.

Frontend environment:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

## Backblaze B2

Used for psychologist profile images and uploaded documents when cloud media is enabled.

```env
USE_CLOUD_MEDIA=True
B2_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_NAME=
B2_ENDPOINT=
B2_REGION=
```

For local development, `USE_CLOUD_MEDIA=False` stores files under `backend/media/`.

## Journal Encryption

Production must use a stable Fernet key:

```env
ENCRYPTION_KEY=
```

If the production encryption key is lost or changed without migration, existing journal entries cannot be decrypted.

## Readiness Check

The backend includes a safe service check command that does not print secrets:

```bash
cd backend
./.venv/bin/python manage.py check_external_services
```

It checks configuration for OpenAI, email, Google Calendar and B2.

## Security Rules

Never commit:

- `.env` files
- API keys
- OAuth client secrets
- service-account JSON files
- private certificates
- generated demo credential snapshots
- uploaded user media
