# Deployment

This guide describes the intended production-style deployment for CareFree. The current repository supports a Vercel frontend and a Railway backend, with PostgreSQL and optional external media storage.

## Recommended Order

1. Push the current repository state to GitHub.
2. Deploy the backend from the repository root using the root `Dockerfile`.
3. Add a PostgreSQL service and configure backend environment variables.
4. Run migrations and seed help categories.
5. Connect external services needed for the full demo.
6. Deploy the frontend from the `frontend/` directory.
7. Configure frontend environment variables.
8. Run a manual smoke test across the main flows.

## Backend On Railway

Create a Railway service from the GitHub repository root. The root `Dockerfile` installs `backend/requirements.txt`, copies `backend/` and `demo_profiles/`, then starts Gunicorn from the backend directory.

Required backend environment variables for production-like deployment:

```env
APP_ENV=production
DEBUG=False
SECRET_KEY=<strong-random-secret>
ENCRYPTION_KEY=<stable-fernet-key>
DATABASE_URL=<railway-postgres-url>
FRONTEND_URL=https://<frontend-domain>
ALLOWED_HOSTS=<backend-domain>,.railway.app
CORS_ALLOWED_ORIGINS=https://<frontend-domain>
CSRF_TRUSTED_ORIGINS=https://<frontend-domain>,https://<backend-domain>
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

Run after the first deploy:

```bash
python manage.py migrate
python manage.py seed_help_categories
```

Create an admin user with a strong password stored outside the repository:

```bash
python manage.py create_superuser \
  --email <admin-email> \
  --password <strong-admin-password> \
  --first-name Admin \
  --last-name User
```

Optional demo seed:

```bash
python manage.py seed_demo_caretakers \
  --count 15 \
  --student-count 4 \
  --password <demo-psychologist-password> \
  --student-password <demo-student-password>
```

The generated demo credential snapshot is local runtime output and is intentionally ignored by Git.

## Frontend On Vercel

Import the GitHub repository into Vercel and set the root directory to `frontend`.

Required frontend environment variables:

```env
NEXT_PUBLIC_BACKEND_URL=https://<backend-domain>
NEXT_PUBLIC_API_URL=https://<backend-domain>/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-client-id>
```

After changing environment variables, redeploy the frontend.

## OpenAI

Julija requires an OpenAI API key for the full assistant experience:

```env
OPENAI_API_KEY=<openai-api-key>
AI_CONVERSATION_MODEL=<primary-conversation-model>
AI_BACKUP_CONVERSATION_MODEL=<backup-conversation-model>
```

Without this key, assistant endpoints still exist but model-backed generation is unavailable and only fallback behavior can run.

## Email

The backend supports Resend as the primary provider and SMTP as fallback.

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=<resend-api-key>
DEFAULT_FROM_EMAIL=<verified-sender>
EMAIL_ASSETS_BASE_URL=https://<frontend-domain>
```

## Google Calendar And Meet

The preferred setup is a shared Google OAuth account for the system calendar.

```env
GOOGLE_CALENDAR_ID=<shared-calendar-id>
GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL=<shared-google-account-email>
GOOGLE_OAUTH_CLIENT_ID=<google-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<google-client-secret>
GOOGLE_OAUTH_REDIRECT_URI=https://<backend-domain>/api/calendar/oauth/callback/
ENABLE_USER_GOOGLE_CALENDAR_SYNC=True
```

After deployment, open:

```text
https://<backend-domain>/api/calendar/system/connect/
```

Then authorize the configured shared Google account and verify:

```text
https://<backend-domain>/api/calendar/shared-status/
```

## Media Storage

For production-like deployments, use cloud media storage for psychologist uploads:

```env
USE_CLOUD_MEDIA=True
B2_KEY_ID=<backblaze-key-id>
B2_APPLICATION_KEY=<backblaze-application-key>
B2_BUCKET_NAME=<bucket-name>
B2_ENDPOINT=<endpoint>
B2_REGION=<region>
```

If this is not configured, uploaded files are stored on the backend filesystem and may not survive redeploys.

## Smoke Test

After deployment, verify:

- login and logout
- student onboarding
- psychologist onboarding and approval
- Julija chat
- search and psychologist profiles
- appointment request creation
- request approval or rejection
- calendar rendering
- Google Meet link creation
- journal create/read/update/delete
- post-session feedback
