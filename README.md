# CareFree

CareFree is a full-stack web application for student psychological support. It combines an AI-assisted first-contact flow, verified psychologist profiles, appointment requests, calendars, journaling and post-session feedback into one application.

The project is built as a monorepo with a Django REST backend and a Next.js frontend. It was developed as a practical health-tech prototype with an emphasis on privacy, clear user flows and responsible use of LLMs in a sensitive domain. CareFree is not a replacement for therapy, diagnosis or emergency support; the AI assistant is designed as an initial support and triage layer that helps users structure their situation and move toward human help.

## What It Does

For students:

- register and complete a student profile
- talk with Julija, an AI assistant for initial support and triage
- receive psychologist recommendations based on the conversation context
- search approved psychologists by name and help categories
- request an appointment from a psychologist profile
- view confirmed appointments and Google Meet links in a calendar
- keep a private encrypted journal
- submit private post-session feedback

For psychologists:

- complete a professional profile with photo, CV, diplomas and certificates
- choose help categories and work approach
- define available one-hour appointment slots
- receive appointment requests from students
- approve or reject requests
- view confirmed appointments in a calendar

For administrators:

- verify psychologist profiles
- approve or deny psychologists
- manage users, categories and stored records through Django admin

## AI And NLP Layer

The main AI component is Julija, a Croatian-language assistant implemented through the OpenAI API. Julija is not a generic chatbot; the backend treats the model response as structured application state.

The assistant flow includes:

- prompt-engineered conversation modes: support, recommendation offer, recommendation ready, support closure and crisis
- strict JSON responses parsed into a Pydantic schema
- category and subcategory extraction mapped to internal help-category codes
- session summaries that can be reused as context in later conversations
- psychologist recommendations based on approved profile categories
- fallback heuristics when the model call fails, times out or lacks enough context
- crisis-oriented behavior with local emergency contacts and separate fallback logic
- redaction of obvious sensitive identifiers before sending user text to the model

The journal module also includes a safety layer. Journal entries are encrypted at rest, and the application can classify potentially high-risk entries through a combination of rule-based checks and an LLM classifier.

## Tech Stack

Backend:

- Python 3.12
- Django 5
- Django REST Framework
- SimpleJWT and cookie authentication
- Celery-ready background task structure
- OpenAI Python SDK
- Google Calendar API
- Fernet encryption through `cryptography`
- optional PostgreSQL, Resend email and Backblaze B2 media storage

Frontend:

- Next.js 16
- React 19
- TypeScript
- SWR
- Tailwind CSS 4
- React Big Calendar
- Radix UI primitives and lucide icons

## Repository Structure

```text
.
├── backend/                 Django REST API and domain modules
│   ├── accounts/            authentication, onboarding, roles, uploads
│   ├── users/               profile endpoints, search and help categories
│   ├── assistant/           Julija sessions, prompts, LLM integration, recommendations
│   ├── appointments/        requests, appointments, availability, feedback
│   ├── calendar_integration/ Google Calendar and Meet integration
│   └── journal/             encrypted journal and safety checks
├── frontend/                Next.js application
│   ├── app/                 routes and pages
│   ├── components/          shared UI and feature components
│   ├── fetchers/            API clients and tests
│   └── lib/                 auth, config, calendar and cache helpers
├── demo_profiles/           demo psychologist images used by seed scripts
├── scripts/                 local helper scripts
├── docs/                    architecture, setup, testing, research and operations docs
└── Dockerfile               backend deployment image
```

Internal backend model names still use `caretaker` in several places. The product-facing UI and documentation use `psychologist` or `psiholog` where appropriate.

## Local Setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_help_categories
python manage.py runserver
```

For local development without external services, the minimal backend environment is:

```env
APP_ENV=development
SECRET_KEY=change-me-for-local-dev
DEBUG=True
FRONTEND_URL=http://localhost:3001
```

If `DATABASE_URL` is not set, the backend uses local SQLite. For the full feature set, configure OpenAI, email, Google Calendar and optional B2 media storage as described in [External Services](docs/external-services.md).

### Frontend

```bash
cd frontend
pnpm install
cp .env.example .env.local
pnpm dev
```

The frontend development server runs on:

```text
http://localhost:3001
```

The backend development server defaults to:

```text
http://localhost:8000
```

## Demo Data

The repository includes demo profile images and seed tooling for local demos.

```bash
DEMO_CARETAKER_PASSWORD=<demo-psychologist-password> \
DEMO_STUDENT_PASSWORD=<demo-student-password> \
bash scripts/seed_demo_caretakers.sh
```

The seed command creates approved psychologist profiles, help-category assignments, availability, demo students, appointment requests and sample feedback. Generated credential snapshots are intentionally ignored by Git and should be shared only out of band.

For a full local reset, see [Local Setup And Seeding](docs/operations/local-setup-and-seeding.md).

## Tests

Backend:

```bash
cd backend
./.venv/bin/python manage.py test
```

Frontend:

```bash
cd frontend
pnpm test -- --runInBand
```

Current test scope and caveats are documented in [Testing](docs/testing/README.md).

## Documentation

Start with [docs/README.md](docs/README.md) for the full documentation map.

Key documents:

- [Architecture](docs/architecture.md)
- [AI Assistant](docs/ai-assistant.md)
- [Deployment](docs/deployment.md)
- [External Services](docs/external-services.md)
- [Testing](docs/testing/README.md)
- [Research Materials](docs/research/README.md)
- [Ethics Materials](docs/ethics/README.md)

## Security Notes

Do not commit `.env` files, API keys, OAuth secrets, local database files, generated credential snapshots or uploaded media. Production deployments must use a strong `SECRET_KEY`, a stable `ENCRYPTION_KEY`, HTTPS-only cookies, explicit CORS/CSRF origins and provider secrets stored in the deployment platform.

Journal content is encrypted at rest, but operational access, backups and key management still matter. LLM redaction is a minimization layer, not a full anonymization guarantee.

## Project Status

The main product flows are implemented and documented: authentication, onboarding, psychologist verification, AI assistant sessions, recommendations, search, booking requests, Google Calendar/Meet integration, calendars, availability, journal and feedback. The project is suitable as a developed prototype, demo system and research artefact, with remaining work mainly around final QA, production hardening, broader clinical validation and long-term operational policies.
