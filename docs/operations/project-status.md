# Project Status

CareFree is in a developed prototype state suitable for demos, portfolio review and research documentation. The main application flows are implemented, while production use would still require final QA, clinical/organizational validation and stricter operational policies.

## Implemented Product Flows

- email/password authentication
- Google login path
- student onboarding
- psychologist onboarding and profile completion
- admin approval/denial for psychologists
- approved psychologist search
- public psychologist profile pages
- appointment request creation
- psychologist approve/reject workflow
- appointment calendar views
- availability grid for psychologists
- shared Google Calendar/Meet integration path
- Julija assistant session flow
- assistant summaries and recommendation handoff
- encrypted student journal
- journal safety messaging
- post-session feedback
- local demo seeding

## Backend

The backend is organized around Django applications:

- `accounts`
- `users`
- `assistant`
- `appointments`
- `calendar_integration`
- `journal`

The production-style configuration is environment-driven: database URL, secret key, encryption key, CORS/CSRF origins, OpenAI, email, Google and media storage are all configured outside the repository.

## Frontend

The frontend is a Next.js application with role-aware screens for students and psychologists. High-traffic pages use SWR and local/session cache helpers to avoid empty reload states when navigating between dashboard, search, calendar, availability, journal and assistant pages.

## AI Assistant

Julija is implemented in `backend/assistant/`. The assistant uses structured model output, conversation modes, category codes, stored summaries, recommendation logic, crisis handling and local fallback behavior. Privacy minimization is implemented through rule-based redaction before model calls.

## Known Caveats

- Full production hardening still depends on final environment configuration.
- Cross-site cookie behavior is more reliable with custom frontend/backend domains under the same root domain.
- AI latency depends on external model response time.
- Google Calendar/Meet behavior depends on a valid shared OAuth credential after every database reset.
- The system is a prototype and should not be presented as a medical device, diagnostic system or emergency response service.

## Recommended Remaining Work

- complete manual end-to-end QA on the deployed environment
- add more UI and browser-level tests
- add a clearer production incident/escalation policy if real users are onboarded
- review data retention for assistant sessions, transcript snapshots, journal entries and calendar logs
- decide whether old internal `caretaker` naming should be refactored after the current delivery
