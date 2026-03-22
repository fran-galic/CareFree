CareFree session summary

Current state
- Repository is now in a working deployed-demo state, not just a local MVP state.
- Backend is deployed on Railway.
- Frontend is deployed on Vercel.
- Core flows work end-to-end:
  - email/password login
  - Google login
  - student onboarding
  - caretaker onboarding/profile completion
  - caretaker search
  - public caretaker profile
  - booking request flow
  - caretaker request approval/rejection
  - student and caretaker calendars
  - caretaker availability editing
  - AI assistant flow
  - demo seed users
  - Django admin

Live deployment state
- Frontend URL:
  - `https://carefree-mu.vercel.app`
- Backend URL:
  - `https://carefree-production.up.railway.app`
- Admin URL:
  - `https://carefree-production.up.railway.app/admin/login/`
- Shared Google Calendar credential is connected and passing checks.
- Backend external services check reached:
  - `4/4 OK`

Important deployment/config work completed
- Railway backend deploy from repo root Dockerfile was aligned and made to work.
- Railway public networking issue was diagnosed and fixed:
  - app was listening on `PORT=8080`
  - public Railway domain had to point to `8080`
- Frontend and backend were wired together through:
  - `FRONTEND_URL`
  - `CORS_ALLOWED_ORIGINS`
  - `CSRF_TRUSTED_ORIGINS`
- Google OAuth was configured for both:
  - frontend Google login
  - backend shared Google Calendar callback
- Vercel and Railway env values were aligned to the same Google OAuth client.

Backend hardening and migration fixes completed
- Fresh production database migration path was fixed.
- Main fixes:
  - `HelpCategory.label` length increased
  - `HelpCategory.slug` length increased
  - `accounts.0018` migration updated to alter schema before seeding data
  - `accounts.0018` made non-atomic for PostgreSQL trigger/index compatibility
  - `Caretaker.tel_num` length increased
  - missing appointments index rename migration added
- Result:
  - fresh production migration now works
  - demo seed works on a clean production DB

Demo data state
- Demo caretaker seed is implemented and production-usable.
- Demo seed creates:
  - 15 demo caretakers from `demo_profiles/`
  - 4 demo students
  - caretaker images
  - CVs
  - diplomas
  - certificates
  - help category assignments
  - availability
  - sample appointment/feedback data
- Demo caretakers are approved and profile-complete after seed.
- Shared demo passwords:
  - caretakers: `DemoPsiholog123!`
  - students: `DemoStudent123!`

Auth and account-flow fixes completed
- Email/password login works.
- Google login works.
- Delete account flow was cleaned up:
  - backend deletes the user and clears auth cookies
  - frontend clears session cache and returns user to landing page
- Caretaker guard was added:
  - unapproved or incomplete caretaker is forced onto caretaker profile completion page
  - restricted caretaker navigation is hidden until profile is complete and approved

Calendar / booking state
- Shared Google Calendar and Meet integration works through shared OAuth credential.
- Booking flow supports:
  - student request creation
  - caretaker approval/rejection
  - appointment creation
  - Google Meet generation
  - email notifications
- Calendar UIs include completed sessions as history where appropriate.
- Availability window and student slot window are aligned around the shared calendar constants.

Performance work completed
- Multiple frontend pages now use session cache / fallback snapshots so returning to a page no longer starts from empty state.
- Session/local cache now covers the main high-traffic flows:
  - student dashboard
  - caretaker request list
  - student search
  - public caretaker detail
  - caretaker slots
  - student calendar
  - caretaker calendar
  - caretaker availability grid
  - journal
  - active AI conversation state
- Route prefetching added on:
  - student dashboard quick actions
  - caretaker dashboard quick actions
- Avatar/image loading improved with more aggressive client-side reuse and preload behavior.
- Backend query optimization/hardening completed on:
  - caretaker search
  - help categories
  - caretaker detail
  - appointment list/calendar querysets
  - caretaker slots service

Assistant / AI state
- Julija assistant is implemented in `backend/assistant/`.
- Sessions, messages and summaries persist in DB.
- Frontend assistant UX now supports:
  - immediate local welcome message
  - restored active chat from session storage
  - recommendation state persistence
  - smoother revisit to messages page
- AI remains the most behaviorally complex subsystem, but it is functioning for demo use.

Student-side UX state
- Search now supports:
  - query
  - category filters
  - seeded stable ordering
  - backend batch fetch with frontend 6-per-page presentation
- Public caretaker detail now feels faster because detail, summaries and slots can return from cache immediately on revisit.
- Student dashboard cards no longer need to fully reload every time the user returns to the page.
- Student calendar and journal now resume from cached snapshots before background revalidation.

Caretaker-side UX state
- Caretaker dashboard is wired to requests / calendar / availability.
- Requests page now reuses cached request lists.
- Caretaker calendar reuses cached appointments.
- Availability grid reuses cached rendered slot state and then refreshes in background.

Testing / verification state
- Backend `manage.py check` passes.
- Frontend `pnpm exec tsc --noEmit` passes.
- Frontend targeted lint passes on the touched files.
- Backend automated test suite previously reached:
  - `35/35` passing for targeted test sets in this session
- Additional targeted appointment tests passed after slot/runtime fixes.

Known architectural caveats
- Cookie auth across `vercel.app` frontend and `railway.app` backend can still be browser-dependent, especially on mobile / stricter privacy setups.
- For the most stable long-term auth behavior, custom domains under the same root domain would still be the preferred next deployment improvement.
- AI latency can still feel slower than the rest of the app because the first model response is a real upstream wait, not just frontend rendering time.

What still makes sense to do later
- Custom domains for frontend and backend:
  - for more reliable cookie/auth behavior
  - e.g. `app.<domain>` and `api.<domain>`
- Real backend profiling under deployed traffic:
  - measure the slowest routes instead of guessing
- Potential DB/index tuning based on profiling results
- Optional further AI orchestration cleanup in `backend/assistant/views.py`
- Final QA pass across:
  - mobile login behavior
  - booking flow
  - Google Meet flow
  - demo account flows
  - delete-account flow
  - caretaker approval/profile restrictions

Operational reset guidance
- If you want a true clean reset of the demo system:
  - reset Railway Postgres
  - clear or replace B2 bucket if you want media fully reset too
  - re-run migrations
  - recreate admin
  - re-seed help categories
  - re-seed demo caretakers/students
  - reconnect shared Google Calendar credential
- If you only want demo accounts refreshed, `seed_demo_caretakers` is enough.

Source-of-truth docs added
- Deployment / setup guide:
  - `DEPLOYMENT_GUIDE.md`
- Demo sharing / reset handoff:
  - `DEMO_HANDOFF.md`
