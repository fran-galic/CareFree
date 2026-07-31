# Architecture

CareFree is organized as a monorepo with a Django REST backend, a Next.js frontend and supporting documentation/scripts. The backend owns business rules and persistence. The frontend owns role-specific user workflows and UI state. External services are integrated through explicit backend modules and environment variables.

## High-Level Flow

```text
Student / Psychologist browser
        |
        v
Next.js frontend
        |
        v
Django REST API
        |
        +--> database: users, sessions, appointments, journal, summaries
        +--> OpenAI: assistant and journal safety classification
        +--> Google Calendar: appointments and Meet links
        +--> email provider: registration and appointment notifications
        +--> media storage: psychologist uploads and profile images
```

## Backend Modules

- `accounts`: custom user model, student/psychologist role setup, onboarding, Google login, file uploads and admin verification.
- `users`: authenticated profile endpoints, help categories and psychologist search.
- `assistant`: Julija conversation sessions, prompts, LLM calls, structured parsing, summaries and recommendation matching.
- `appointments`: appointment requests, approvals, availability slots, reservation holds, feedback and calendar payloads.
- `calendar_integration`: shared Google OAuth credentials, Calendar API access and Meet link creation.
- `journal`: encrypted journal entries and safety classification.

## Frontend Areas

- `app/accounts/*`: registration, login and onboarding entry points.
- `app/carefree/messages`: Julija chat UI and recommendation handoff.
- `app/carefree/search`: psychologist search and category filtering.
- `app/carefree/caretaker/[id]`: public psychologist profile and booking request flow.
- `app/carefree/calendar`: student and psychologist calendar view.
- `app/carefree/dostupnost`: psychologist availability grid.
- `app/carefree/requests`: psychologist request inbox.
- `app/carefree/journal`: private student journal.

## Data Design Notes

The system separates raw conversations, structured session state and stored summaries. Appointment requests can include a short user message, an AI summary and an optional transcript snapshot depending on the booking path and consent state.

Journal entries store encrypted content through Fernet encryption. The serializer returns decrypted content only through authenticated journal endpoints.

Psychologist search and assistant recommendations both depend on approved psychologists and help categories. Assistant recommendations prioritize subcategory matches, then broader category matches, then a general fallback.

## Terminology

The codebase still uses `caretaker` for the psychologist role in models, routes and serializers. This is a legacy internal name. Product-facing text should use `psychologist` in English or `psiholog` in Croatian.
