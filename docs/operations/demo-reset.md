# Demo Reset

This document describes a repeatable reset flow for a deployed demo environment.

## When To Use This

Use this procedure when you want to:

- remove old test data
- reseed demo psychologists and students
- restore a predictable demo data set
- verify external-service configuration

## Clean Database Reset

In the backend shell for the deployed environment:

```bash
cd /app/backend
python manage.py flush --noinput
python manage.py migrate
python manage.py seed_help_categories
python manage.py seed_demo_caretakers \
  --count 15 \
  --student-count 4 \
  --password <demo-psychologist-password> \
  --student-password <demo-student-password>
python manage.py check
python manage.py check_external_services
```

Create or recreate an admin account with credentials stored outside the repository:

```bash
python manage.py create_superuser \
  --email <admin-email> \
  --password <strong-admin-password> \
  --first-name Admin \
  --last-name User
```

## Google Calendar Note

`flush` removes the stored shared Google OAuth credential from the database. After the reset, reconnect the shared account:

```text
https://<backend-domain>/api/calendar/system/connect/
```

Then verify:

```bash
cd /app/backend
python manage.py check_external_services
```

## Media Storage

Database reset does not delete objects from cloud media storage. If a truly clean demo environment is required, also clear the configured media bucket or create a new empty bucket and update environment variables.

## Local Credential Snapshot

The seed command can produce a local account snapshot under:

```text
generated/LOCAL_DEMO_CREDENTIALS.md
```

This file is ignored by Git. Do not commit generated passwords or private account lists.
