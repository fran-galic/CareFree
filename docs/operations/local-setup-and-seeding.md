# Local Setup And Seeding

This document covers local reset and demo data setup.

## Backend Prerequisites

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Local Reset

From the repository root:

```bash
bash scripts/reset_local_app.sh
```

The script:

- removes local SQLite database output
- removes local uploaded media
- runs migrations
- seeds help categories

It does not create an admin account unless explicitly requested.

To create a local admin during reset:

```bash
CREATE_LOCAL_ADMIN=true \
SUPERUSER_EMAIL=admin@carefree.local \
SUPERUSER_PASSWORD=<local-admin-password> \
bash scripts/reset_local_app.sh
```

Do not reuse this local password in production or commit it anywhere.

## Demo Seed

From the repository root:

```bash
DEMO_CARETAKER_PASSWORD=<demo-psychologist-password> \
DEMO_STUDENT_PASSWORD=<demo-student-password> \
bash scripts/seed_demo_caretakers.sh
```

The seed script:

- uses images from `demo_profiles/`
- creates approved psychologist profiles
- attaches placeholder CV/diploma/certificate documents
- assigns help categories
- creates availability for the booking window
- creates demo students
- creates sample appointment requests, appointments and feedback
- writes a local credential snapshot to `generated/LOCAL_DEMO_CREDENTIALS.md`

`generated/LOCAL_DEMO_CREDENTIALS.md` is intentionally ignored by Git.

Useful options:

```bash
DEMO_CARETAKER_PASSWORD=<demo-psychologist-password> DEMO_STUDENT_PASSWORD=<demo-student-password> bash scripts/seed_demo_caretakers.sh --count 10
DEMO_CARETAKER_PASSWORD=<demo-psychologist-password> DEMO_STUDENT_PASSWORD=<demo-student-password> bash scripts/seed_demo_caretakers.sh --student-count 4
bash scripts/seed_demo_caretakers.sh --password '<demo-psychologist-password>' --student-password '<demo-student-password>'
```

## Recommended Local Demo Flow

```bash
bash scripts/reset_local_app.sh
DEMO_CARETAKER_PASSWORD=<demo-psychologist-password> \
DEMO_STUDENT_PASSWORD=<demo-student-password> \
bash scripts/seed_demo_caretakers.sh
```

Then run:

```bash
cd backend
./.venv/bin/python manage.py runserver
```

And in a second terminal:

```bash
cd frontend
pnpm dev
```

## What The Scripts Do Not Configure

- OpenAI API access
- email provider credentials
- shared Google Calendar OAuth credentials
- cloud media storage
- production security settings
