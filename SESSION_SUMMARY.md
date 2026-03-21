CareFree session summary

Current state
- App is in late polish / pre-deploy phase.
- Core flows are implemented:
  - auth / onboarding
  - psychologist search
  - public booking
  - request approval flow
  - shared Google Calendar / Meet sync
  - student and psychologist in-app calendars
  - caretaker availability management
- The app now also has a first MVP of post-session feedback between student and psychologist.
- Remaining work is now mostly:
  - assistant / AI flow hardening and completion
  - final end-to-end QA
  - deployment / production setup

Main product decisions
- Keep email/password auth.
- Keep Google login as optional auth path.
- Use one shared system Google Calendar account for appointment event creation.
- App database remains source of truth for appointments.
- Google Meet links are generated from backend during Calendar event creation.
- Student and psychologist both see appointments inside the app calendar.
- Post-session feedback is private:
  - not a public review
  - not a star rating
  - visible only to the student and the psychologist tied to that session

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
- A previous local DB reset deleted the stored shared OAuth credential.
- That broke reliable Meet generation because the app effectively fell back toward the older service-account path.
- After reconnecting the shared Google account through:
  - `/api/calendar/system/connect/`
  Meet generation worked again.

Google hardening that was added
- Backend no longer silently hides the missing shared OAuth problem.
- If shared calendar account is configured but `SystemGoogleCredential` is missing, backend surfaces that clearly.
- Relevant files:
  - `backend/calendar_integration/google_client.py`
  - `backend/accounts/management/commands/check_external_services.py`
  - `backend/calendar_integration/views.py`
  - `backend/calendar_integration/urls.py`

Working-hours and scheduling window
- Shared frontend constants centralize working hours and allowed window in:
  - `frontend/lib/calendar.ts`
- Current intended standard workday:
  - `08:00-18:00`
- Booking and in-app calendar navigation are intentionally constrained to:
  - current week
  - next week

Student-side completed work
- Student search UX was polished:
  - stable randomized ordering through a `seed` query param
  - smoother pagination
  - better loading state on first load
  - no false empty/error flicker before psychologists load
- Search cards now:
  - show at most 4 category chips
  - collapse extras into `+N`
- Pagination now smooth-scrolls to results, including when returning to page 1.
- Public psychologist profile / booking page was improved:
  - clearer booking flow
  - denser but cleaner slot cards
  - calmer loading placeholder for slots
- Student dashboard now:
  - hides past appointments from the “Sljedeći termin” card
  - routes to psychologist search if there is no upcoming appointment
  - does not show stale old meeting banners after a date has passed
- Student calendar now:
  - has polished month/week/day/agenda rendering
  - shows Meet state cleanly
  - keeps completed sessions visible as history
  - can show the student’s own post-session feedback on completed sessions

Psychologist-side completed work
- Psychologist dashboard / visual system was refined into a calmer teal clinical direction.
- Request handling is cleaner:
  - `Na čekanju` = pending only
  - `Svi zahtjevi` = full request history
- Psychologist calendar now:
  - matches student calendar style more closely
  - supports hover preview cards
  - includes completed sessions for history
  - shows post-session student feedback in completed session details
- Caretaker availability setup now:
  - uses a 1-week window with arrows between current and next week
  - aligns to `08:00-18:00`
  - is more compact and readable

Post-session feedback MVP
- New backend model:
  - `AppointmentFeedback`
- Feedback is tied 1:1 to a completed `Appointment`.
- Student gets a gentle home-screen prompt after a completed session that has no feedback decision yet.
- Student can:
  - submit feedback
  - or dismiss it with `Preskoči za sada`
- Current dismiss behavior:
  - dismiss is final for that appointment
  - the same prompt is not shown again for that session
- Feedback choices currently are:
  - `Osjećam se mirnije`
  - `Razgovor mi je pomogao`
  - `Dobio/la sam više jasnoće`
  - `Još razmišljam o svemu`
- Optional free-text comment is supported.
- Student sees submitted feedback:
  - in their calendar, on the completed session
- Psychologist sees submitted feedback:
  - in `Svi zahtjevi`
  - in psychologist calendar session details
- Relevant backend files:
  - `backend/appointments/models.py`
  - `backend/appointments/serializers.py`
  - `backend/appointments/views.py`
  - `backend/appointments/urls.py`
  - `backend/appointments/migrations/0004_appointmentfeedback.py`
- Relevant frontend files:
  - `frontend/components/student-dashboard.tsx`
  - `frontend/components/appointments/appointment-request-card.tsx`
  - `frontend/app/carefree/calendar/page.tsx`
  - `frontend/app/carefree/availability/page.tsx`
  - `frontend/fetchers/appointments.ts`

Avatar / image handling
- Shared helper:
  - `frontend/components/persistent-avatar-image.tsx`
- Improvements completed:
  - keeps last known avatar while fresh data loads
  - avoids flashing to initials when possible
  - normalizes relative `/media/...` URLs against backend base URL
- Backend serializers also now build absolute image URLs for local media files.

Demo data / local seeding
- Local reset script:
  - `scripts/reset_local_app.sh`
- Demo caretaker seed command:
  - `backend/accounts/management/commands/seed_demo_caretakers.py`
- Wrapper script:
  - `scripts/seed_demo_caretakers.sh`
- Current demo-seed behavior:
  - uses images from `demo_profiles/`
  - expects prefixes:
    - `m_` for male
    - `w_` for female
  - assigns Croatian names consistent with image sex prefix
  - uses more professional student-facing descriptions
  - seeds future availability
  - seeds demo student examples for feedback flow
  - removes stale demo users when matching images disappear
  - falls back to a generated placeholder PDF if the old demo PDF is missing
- Current default passwords:
  - demo psychologists: `DemoPsiholog123!`
  - demo student: `DemoStudent123!`
- Current local demo state:
  - `15` demo psychologists
  - `12` female
  - `3` male
  - all have future availability
  - one demo student exists specifically for feedback testing:
    - `demo.student@carefree.local`
  - seeded demo feedback examples:
    - one completed session with no feedback yet, so student sees the prompt
    - one completed session with submitted feedback, so psychologist can inspect the display

Scripts / docs currently relevant
- `scripts/reset_local_app.sh`
  - resets local SQLite DB and media
  - reruns migrations
  - reseeds categories
  - recreates default admin:
    - `admin@carefree.com`
    - `admin123`
- `scripts/seed_demo_caretakers.sh`
  - seeds demo psychologists and demo student data
- `scripts/LOCAL_SETUP_AND_SEEDING.md`
  - local setup and seeding instructions
- `scripts/DEMO_PSYCHOLOGISTS_CREDENTIALS.md`
  - current demo psychologist emails and shared password

Current important caveats
- If Google Meet suddenly stops generating after a DB reset, first suspect missing `SystemGoogleCredential`.
- In that case:
  - check `/api/calendar/shared-status/`
  - run `check_external_services`
  - reconnect shared account through `/api/calendar/system/connect/`
- Assistant / AI flow still works, but it is less hardened than booking/calendar/auth.
- Important assistant caveat:
  - conversation logic and summary generation are still too concentrated inside `backend/assistant/views.py`
  - session end flow is not yet as production-clean as the calendar / booking side

Likely next work
- Finish and harden the AI / assistant flow:
  - cleaner session ending
  - clearer summary generation path
  - recommendation logic review
- Final pass of end-to-end QA:
  - booking
  - approval
  - Meet generation
  - mail flows
  - feedback flow
  - calendar displays
- Prepare deployment:
  - production env vars
  - media/static hosting
  - shared Google credential setup
  - mail config
  - domain / HTTPS / CORS / cookie settings
