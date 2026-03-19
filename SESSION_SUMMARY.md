CareFree session summary

Current state
- App is in late polish / pre-deploy phase.
- Core booking flow, psychologist/student dashboards, Google Calendar integration, and most UX polish are implemented.
- Calendar and availability UX are now more tightly constrained to a shared 2-week scheduling window.
- Registration / onboarding flow is more consistent end-to-end and now returns users to login after successful account activation.
- Remaining work is mostly:
  - final testing
  - a few smaller fixes/additions
  - feedback after conversation flow
  - deployment
  - seeding richer mock/demo data

Main product decisions
- Keep email/password auth.
- Keep Google login as optional auth path.
- Do not sync each user private Google Calendar.
- Use one shared system Google Calendar for appointment event creation.
- App database remains source of truth for appointments.
- Google Meet links are generated from backend during Google Calendar event creation.
- Both student and psychologist should see appointments and Meet link inside the in-app calendar.

Google Calendar / Google Meet
- Correct working path is the shared OAuth account approach.
- Shared account used in project:
  - `carefree.calendar1@gmail.com`
- Stored shared OAuth credential model:
  - `SystemGoogleCredential`
- Important env/config path:
  - `GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL=carefree.calendar1@gmail.com`
- OAuth connect endpoint:
  - `/api/calendar/system/connect/`
- Shared Google status check endpoint:
  - `/api/calendar/shared-status/`

Important Google issue that happened
- At one point Meet generation stopped working.
- Root cause was not frontend and not event rendering.
- Root cause was that local DB had been reset, which deleted the stored `SystemGoogleCredential`.
- Because of that, shared OAuth path was missing.
- The app then effectively fell back into the service-account path.
- In that mode:
  - events could still be created in some cases
  - but Google Meet link was not reliably generated / returned
  - `conference_link` stayed empty
- After reconnecting the shared Google account through:
  - `/api/calendar/system/connect/`
  Meet generation worked again.

Google hardening that was added
- Backend now no longer silently hides the missing shared OAuth problem.
- If shared calendar account is configured but `SystemGoogleCredential` is missing, backend surfaces that clearly.
- Relevant files:
  - `backend/calendar_integration/google_client.py`
  - `backend/accounts/management/commands/check_external_services.py`
  - `backend/calendar_integration/views.py`
  - `backend/calendar_integration/urls.py`
- `check_external_services` now explicitly warns when shared Google credential is missing.
- `/api/calendar/shared-status/` can be used as a quick health check.

Google / booking flow status now
- Booking flow has been confirmed working when shared OAuth credential is present.
- Confirmed path:
  - student sends request
  - psychologist accepts
  - appointment is created
  - Google Calendar event is created
  - Google Meet link is generated
  - `conference_link` is stored
  - both sides can see result in app calendar
- Calendar UI now also explains intermediate states:
  - `confirmed_pending_sync`
  - `confirmed_sync_failed`
- Meet block is shown explicitly when `conference_link` exists.

Mail status
- Mail system was cleaned up and made more consistent.
- Main mail flows are already hooked into shared mail rendering:
  - registration completion
  - password reset
  - caretaker approval / denial
  - appointment request notifications
  - appointment confirmations
  - test mail command
- Mail image rendering is not final for production because public asset hosting should be finalized during deployment.

Student-side changes completed
- Google signup / onboarding flow was improved so user lands on completion step after Google auth.
- Student home page now shows meaningful appointment request status instead of leaving request “in the air”.
- Student sees:
  - waiting for psychologist response
  - accepted request
  - rejected request
- Accepted-state banner remains until student opens calendar / appointment details once.
- `Poslani zahtjevi` now uses real backend data.
- Student search/profile/booking flow was polished.
- Student psychologist profile page (`/carefree/caretaker/[id]`) was improved:
  - cleaner booking layout
  - better detail content
  - clearer request / Meet messaging

Student calendar status
- Student calendar (`frontend/app/carefree/calendar/page.tsx`) was heavily improved.
- It now has:
  - cleaner month / week / day rendering
  - custom agenda rendering
  - better event titles / shortening behavior
  - explicit Meet status messaging
  - dedicated Google Meet block when link exists
- Calendar navigation is now clamped to the current + next week window instead of allowing free browsing far outside the active scheduling range.
- A shared frontend helper now centralizes calendar window logic:
  - `frontend/lib/calendar.ts`
- Calendar event layout was polished through:
  - `frontend/app/carefree/calendar/page.tsx`
  - `frontend/app/globals.css`

Psychologist-side changes completed
- Caretaker / psychologist visual system was redesigned into a calmer teal-based direction.
- Important visual direction:
  - dark teal professional accent
  - warm clinical white / neutral base
  - subtle top + left teal accents on cards
  - minimal shadows
  - warm informational boxes
- Key files:
  - `frontend/app/globals.css`
  - `frontend/app/carefree/layout.tsx`
  - `frontend/components/caretaker-dashboard.tsx`
  - `frontend/app/carefree/requests/page.tsx`
  - `frontend/components/appointments/appointment-request-list.tsx`
  - `frontend/components/appointments/appointment-request-card.tsx`
  - `frontend/app/carefree/availability/page.tsx`
  - `frontend/app/carefree/dostupnost/page.tsx`
  - `frontend/app/carefree/profile/caretaker/page.tsx`

Psychologist profile work completed
- Caretaker profile supports:
  - DOB field
  - privacy toggles for showing email / phone to students
  - exactly one required CV
  - multiple diplomas
  - multiple certificates
  - profile picture upload with crop flow
- UI was improved:
  - clearer incomplete / pending approval / approved states
  - destructive colors softened into warmer brick tone
  - upload blocks cleaned up
  - file overflow fixed
  - categories reordered so `Ostalo` is last
- There is now clearer profile completeness messaging:
  - required CV
  - at least one diploma
  - profile image
  - basic data

Avatar / image handling improvements
- Avatar persistence was improved to reduce flashing and missing images.
- Shared helper:
  - `frontend/components/persistent-avatar-image.tsx`
- Goal:
  - once avatar is loaded, keep showing last known avatar while fresh data is loading
  - fallback to initials only when no real image is available
- This was wired into:
  - main layout/header
  - profile header
  - public psychologist profile
  - search cards
  - recommendations / messages areas

Appointment request handling completed
- Psychologist request tabs now make more sense:
  - `Na čekanju` = only pending
  - `Svi zahtjevi` = full request history
- Student request data is now available through dedicated backend endpoint.
- Request cards / pages now show better state and Meet info.
- Relevant backend files:
  - `backend/appointments/serializers.py`
  - `backend/appointments/views.py`
  - `backend/appointments/urls.py`
- Relevant frontend files:
  - `frontend/fetchers/appointments.ts`
  - `frontend/components/student-dashboard.tsx`
  - `frontend/components/appointments/appointment-request-list.tsx`
  - `frontend/components/appointments/appointment-request-card.tsx`

Psychologist calendar status
- Psychologist in-app calendar (`frontend/app/carefree/availability/page.tsx`) was aligned with student calendar style.
- It now has:
  - matching toolbar
  - custom agenda rendering
  - improved event layout
  - shortened names where useful
  - full name on day view
  - explicit Meet state / link handling in details panel
- Just like the student calendar, navigation is now limited to the active 2-week scheduling window.

Availability / slot-setting status
- Caretaker availability grid (`frontend/app/carefree/dostupnost/page.tsx`) is now explicitly based on the same shared 2-week calendar window helper as the booking calendars.
- Past days remain visible for orientation, but are visually muted and locked.
- This reduces mismatch between:
  - caretaker slot setup
  - student slot browsing
  - in-app calendar navigation

Booking page / request UX updates
- Public caretaker page (`/carefree/caretaker/[id]`) was further cleaned up after the previous summary.
- Booking flow on that page now more clearly explains:
  - choose a slot
  - add a short reason/message
  - wait for caretaker confirmation
- Week switching on the booking page is now intentionally constrained to:
  - this week
  - next week
- Privacy / safety / expectation-setting copy on the caretaker page is clearer than before.

Auth / onboarding flow updates
- Account completion flow now consistently redirects users back to login after successful registration instead of leaving them in an ambiguous authenticated state.
- Login page now detects successful activation through:
  - `?registered=1`
  and shows a confirmation message before login.
- This applies to both:
  - normal email/password completion
  - Google onboarding completion

Local reset / utility work completed
- Local reset script was added:
  - `scripts/reset_local_app.sh`
- It resets local app state, reruns migrations, reseeds categories, and recreates default superuser.
- Default local superuser credentials after reset script:
  - email: `admin@carefree.com`
  - password: `admin123`

Current important caveats
- If Google Meet suddenly stops generating again after local DB reset, first suspect missing `SystemGoogleCredential`.
- In that case:
  - check `/api/calendar/shared-status/`
  - run `check_external_services`
  - reconnect shared account through `/api/calendar/system/connect/`
- Existing appointments that already failed sync may need retry / recreation after reconnect.
- `assistant` flow still works, but it is less production-hardened than booking/calendar/auth.
- Important assistant caveat:
  - conversation logic and summary generation are still implemented directly inside `backend/assistant/views.py`
  - `EndSesssionView` currently closes the session without generating the summary that the older commented-out flow suggests
  - the more complete summary/recommendation path currently happens during `SessionMessageView` when the model decides the conversation is ready

Likely next work
- Final pass of app testing end-to-end:
  - booking
  - request handling
  - Google Meet generation
  - mail confirmation flow
  - calendar display
- Add missing features around conversation end flow:
  - feedback after conversation / after meeting
- Final smaller CareFree app fixes discovered during QA
- Prepare production deployment
- Seed database with useful mock/demo data for presentation / testing

Demo data seeding completed
- Demo psychologist seeding is now implemented and working locally.
- New management command:
  - `backend/accounts/management/commands/seed_demo_caretakers.py`
- New wrapper script:
  - `scripts/seed_demo_caretakers.sh`
- What it does:
  - uses all 23 images from `demo_profiles`
  - creates 23 approved and complete demo psychologists
  - assigns Croatian names and surnames
  - fills realistic `about_me`, phone, grad year, categories
  - uploads exactly 1 CV
  - uploads 1 or 2 diplomas
  - uploads 0 to 2 certificates
  - seeds availability slots for the next 2 weeks
- Current local seeded result:
  - 23 demo psychologists
  - 23 approved
  - 23 complete profiles
  - 506 availability slots
  - 23 CV files
  - 35 diploma files
  - 24 certificate files
- Shared password for generated demo psychologists:
  - `DemoPsiholog123!`

Demo image / media fix completed
- After demo seeding, profile images initially did not render.
- Root cause:
  - files were saved locally into `backend/media`
  - but backend still generated cloud/B2 media URLs in local dev
  - Django also was not serving `/media/...` in debug mode
- Fixes added:
  - local development now defaults to filesystem media storage
  - cloud media is used only when explicitly enabled with:
    - `USE_CLOUD_MEDIA=true`
  - debug mode now serves `MEDIA_URL` through Django
- Relevant files:
  - `backend/backend/settings.py`
  - `backend/backend/urls.py`
- Important note:
  - after this change, backend restart is needed for local image rendering to work

Useful local commands for next session
- Reset local app:
  - `./scripts/reset_local_app.sh`
- Seed demo psychologists:
  - `./scripts/seed_demo_caretakers.sh`
- Optional seed variants:
  - `./scripts/seed_demo_caretakers.sh --count 10`
  - `./scripts/seed_demo_caretakers.sh --password "NovaLozinka123!"`

Recommended continuation
- Start from smoke testing and final QA, not from broad redesign.
- Keep current caretaker visual direction unless a concrete issue appears.
- Treat Google Meet issues primarily as credential/configuration problems first, not UI problems.
- Before deployment, re-verify:
  - shared Google OAuth credential
  - email asset hosting
  - production mail rendering
  - seeded demo data quality
