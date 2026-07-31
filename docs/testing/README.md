# Testing

The project has automated tests for the backend and a smaller frontend test suite for API client behavior. External-service flows such as Google Calendar, email delivery, media storage and full browser-based booking still require manual QA with configured environment variables.

## Backend

Run from `backend/`:

```bash
./.venv/bin/python manage.py test
```

The backend test suite covers:

- user and student model behavior
- email and file validation edge cases
- assistant session start/end guards
- prompt and context-building behavior
- recommendation flow
- fallback category inference
- crisis fallback behavior
- summary detail behavior
- journal encryption and safety-related behavior
- appointment service edge cases

For a clean local test run that avoids external provider configuration:

```bash
env -u DATABASE_URL -u OPENAI_API_KEY -u GOOGLE_SERVICE_ACCOUNT_JSON -u GOOGLE_SERVICE_ACCOUNT_FILE -u GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL -u GOOGLE_CALENDAR_ID -u B2_KEY_ID -u B2_APPLICATION_KEY -u B2_BUCKET_NAME -u B2_ENDPOINT APP_ENV=test DEBUG=True ./.venv/bin/python manage.py test --noinput
```

## Frontend

Run from `frontend/`:

```bash
pnpm test -- --runInBand
```

The current frontend tests cover:

- successful API calls
- HTTP error handling
- network error handling
- help-category fetch behavior
- psychologist search fetch behavior

## Manual QA

Before a public demo or production-like deployment, manually verify:

- email/password signup and login
- Google login
- student onboarding
- psychologist onboarding and approval
- Julija chat and recommendation handoff
- search and psychologist profile pages
- appointment request creation
- approve/reject request flow
- Google Calendar and Meet link creation
- student and psychologist calendar views
- availability grid
- journal CRUD and crisis messaging
- post-session feedback
