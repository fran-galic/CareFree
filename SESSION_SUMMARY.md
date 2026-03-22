CareFree session summary

Current state
- The repository is in a solid MVP / pre-release state.
- Core app flows are implemented and working together.
- Booking, calendar, auth and caretaker availability are the most mature areas.
- Assistant / AI is functional and already significantly beyond a rough prototype, but it is still the area that deserves the most additional hardening before production.

Implemented product scope
- Email/password auth with cookie-based JWT flow.
- Optional Google login handled by backend token verification.
- Student onboarding and caretaker onboarding.
- Caretaker profile completion with uploads:
  - profile image
  - CV
  - diplomas
  - optional certificates
- Approved caretaker search with category filters and stable randomized ordering.
- Public caretaker profile page with slot selection and request submission.
- Appointment request lifecycle:
  - student creates request
  - caretaker approves or rejects
  - confirmed appointment is created
- Shared Google Calendar event creation and Google Meet link generation.
- Student and caretaker in-app calendars.
- Caretaker availability management across a two-week booking window.
- Student journal with encrypted entry content.
- Post-session appointment feedback.
- AI assistant sessions, summaries and recommendation flow.

Assistant / AI state
- Julija assistant is implemented in `backend/assistant/`.
- Sessions are persisted through:
  - `AssistantSession`
  - `AssistantMessage`
  - `AssistantSessionSummary`
- Assistant supports:
  - normal support conversation
  - recommendation offer / recommendation-ready flow
  - crisis mode
  - manual session ending
- Summaries store:
  - summary text
  - category codes and labels
  - transcript snapshot
  - recommended caretaker ids
- Recommendation matching is category-based and enriches caretaker cards with assistant-relevant categories.
- Frontend chat UX already supports:
  - persisted active session restore
  - crisis panel
  - recommendation transition screen
  - summary detail page

Assistant caveats
- The AI area still contains the highest concentration of behavioral complexity.
- `backend/assistant/views.py` still owns too much orchestration logic.
- Crisis handling and fallback heuristics are present and tested, but should still get a deliberate QA pass with real conversational edge cases.
- Recommendation closure and session-end behavior should be re-checked before production.

Calendar / Meet state
- Current preferred setup is shared OAuth credential for a shared Google account.
- Relevant model:
  - `SystemGoogleCredential`
- Relevant endpoints:
  - `/api/calendar/system/connect/`
  - `/api/calendar/shared-status/`
- Important behavior:
  - if `GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL` is configured, backend expects a stored shared OAuth credential
  - if it is missing, backend surfaces that as a configuration problem instead of silently hiding it
- Service-account-based access still exists as fallback when shared OAuth is not configured.

Known calendar caveat
- After a local DB reset, the stored shared OAuth credential may disappear because it lives in the DB.
- If that happens:
  - Meet generation can stop working
  - first check `/api/calendar/shared-status/`
  - then run `python manage.py check_external_services`
  - then reconnect the shared account through `/api/calendar/system/connect/`

Scheduling rules
- Shared frontend scheduling constants live in `frontend/lib/calendar.ts`.
- Current booking window:
  - current week + next week
  - total 14 days
- Current workday:
  - `08:00-18:00`
- Caretaker availability UI and student booking UI both follow that window.

Student-side state
- Search UX includes:
  - text query
  - category filters
  - stable randomized seed
  - pagination
  - smoother loading behavior
- Public caretaker page supports:
  - availability view grouped by day
  - booking note
  - request creation
- Student dashboard supports:
  - upcoming appointment card
  - latest request state
  - post-session feedback prompt
- Student calendar supports:
  - active appointments
  - completed sessions as history
  - Meet link visibility
  - own feedback visibility on completed sessions

Caretaker-side state
- Caretaker dashboard links to:
  - requests
  - calendar
  - availability
- Request handling supports:
  - pending filter
  - full request history
  - approve / reject
  - visibility of feedback for completed sessions
- Availability UI supports:
  - two-week window
  - week-by-week display
  - bulk save
  - occupied-slot protection
- Caretaker calendar includes completed sessions in history.

Journal state
- Journal entries are encrypted at rest through `ENCRYPTION_KEY`.
- In debug mode, backend can generate a temporary encryption key automatically.
- That is development-only behavior and must not be relied on in production.

Feedback MVP state
- `AppointmentFeedback` is implemented and tied 1:1 to `Appointment`.
- Student can:
  - submit a private response
  - add optional comment
  - dismiss with a final `dismissed` state
- Feedback is visible only in the relevant student/caretaker context.

Testing state
- Backend automated tests:
  - 35 tests
  - all passing
- Frontend automated tests:
  - 6 tests
  - all passing
- Existing old test documentation that mentions 11 backend tests is outdated and has been superseded by the current repo state.

Repo hygiene state
- Repo should not track:
  - `.env` files
  - virtual environments
  - IDE metadata
  - local media
  - ad hoc screenshots and unused asset dumps
- This cleanup has been aligned with the current repo state.

Likely next work
- Finalize documentation and setup guidance.
- Hardening pass on assistant orchestration and conversational edge cases.
- Full end-to-end QA across:
  - auth
  - onboarding
  - search
  - booking
  - approval
  - Meet generation
  - assistant summaries
  - feedback
  - journal
- Production deployment setup:
  - env vars
  - secrets
  - shared Google credential bootstrap
  - media strategy
  - HTTPS / cookies / CORS / CSRF
