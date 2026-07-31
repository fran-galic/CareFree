# Audit repozitorija CareFree za pripremu rada za Rektorovu nagradu

Napomena: ovaj audit je povijesni snapshot stanja repozitorija prije kasnijeg sređivanja dokumentacije i sigurnosnog čišćenja. Neke putanje i nalazi u tablicama odnose se na tadašnje stanje, a trenutna ulazna dokumentacija je u `README.md` i `docs/README.md`.

## Metodologija

Read-only statički audit koda i dokumentacije. Tijekom audita nisu mijenjane ni generirane datoteke i nisu pokretani testovi jer mogu stvarati cache/artefakte. U ovom izvješću nisu navedene tajne, lozinke, tokeni ni demo vjerodajnice.

Statusi korišteni u izvješću:

- `potpuno implementirano i aktivno`
- `djelomično implementirano`
- `implementirano, ali se trenutačno ne koristi`
- `samo dokumentirano ili planirano`
- `nepoznato ili nedovoljno dokazivo`

## A. Struktura i arhitektura sustava

| Komponenta | Status | Dokaz |
|---|---:|---|
| Django backend s aplikacijama za račune, korisnike, asistenta, termine, kalendar i dnevnik | potpuno implementirano i aktivno | `backend/backend/settings.py:INSTALLED_APPS`, `backend/backend/urls.py:urlpatterns` |
| Next.js frontend s javnim i zaštićenim rutama | potpuno implementirano i aktivno | `frontend/app/*/page.tsx`, `frontend/app/carefree/layout.tsx` |
| REST komunikacija frontend-backend | potpuno implementirano i aktivno | `frontend/lib/auth.ts:authFetch`, `frontend/fetchers/*.ts`, `backend/backend/urls.py` |
| JWT autentifikacija kroz header i kolačiće | potpuno implementirano i aktivno | `backend/backend/settings.py:REST_FRAMEWORK`, `backend/accounts/authentication.py:CookieJWTAuthentication`, `frontend/lib/auth.ts` |
| Celery zadaci | djelomično implementirano | `backend/backend/celery.py`, `backend/appointments/tasks.py`, `backend/journal/tasks.py`; dio zadataka nije aktivno korišten ili je neispravan |
| Deployment backend Dockerfile | potpuno implementirano i aktivno kao konfiguracija | `Dockerfile` |
| Vercel/Railway deployment | djelomično dokazivo | `frontend/lib/config.ts`, `DEPLOYMENT_GUIDE.md`, `SESSION_SUMMARY.md`; stvarni trenutni deployment nije provjeren izvan repozitorija |

Glavni entry pointovi:

- `backend/backend/urls.py`
- `backend/backend/settings.py`
- `backend/backend/celery.py`
- `Dockerfile`
- `frontend/app/layout.tsx`
- `frontend/lib/config.ts`
- `frontend/lib/auth.ts`

## B. Tehnološki stog

| Područje | Tehnologija/verzija | Dokaz |
|---|---|---|
| Backend | Django `5.2.7`, DRF `3.16.1`, SimpleJWT `5.5.1` | `backend/requirements.txt` |
| API dokumentacija | drf-spectacular `0.29.0` | `backend/requirements.txt`, `backend/backend/urls.py:/schema,/docs` |
| AI provider | OpenAI Python SDK `2.14.0` | `backend/requirements.txt`, `backend/assistant/llm.py`, `backend/journal/ai.py` |
| AI modeli | default `gpt-5.2-chat-latest`, fallback `gpt-4o-mini`; `AI_STRUCTURED_MODEL=gpt-5.2` konfiguriran, ali nije pronađena aktivna upotreba | `backend/backend/settings.py`, `backend/assistant/llm.py`, `backend/.env.example` |
| Baza | PostgreSQL preko `DATABASE_URL`; fallback SQLite | `backend/backend/settings.py`, `dj-database-url==2.2.0` |
| Asinkrono | Celery `5.6.2`, Redis `7.1.0` | `backend/requirements.txt`, `backend/backend/settings.py` |
| Kalendar | Google Calendar API `2.161.0`, OAuth `1.2.1` | `backend/requirements.txt`, `backend/calendar_integration/*` |
| Storage | lokalni media ili Backblaze B2/S3 kompatibilno preko `django-storages` | `backend/backend/settings.py:STORAGES`, `backend/.env.example` |
| Email | Resend ili SMTP fallback | `backend/backend/emailing.py:send_project_email` |
| Frontend | Next `16.0.10`, React `19.2.0`, SWR `2.3.6`, Tailwind `4` | `frontend/package.json` |
| Frontend kalendar | `react-big-calendar ^1.19.4` | `frontend/package.json`, `frontend/app/carefree/calendar/page.tsx` |

## C. Funkcionalnosti prema korisničkim ulogama

| Funkcionalnost | Status | Dokaz |
|---|---:|---|
| Registracija e-mail tokenom | potpuno implementirano i aktivno | `backend/accounts/views.py:RequestRegistrationTokenView`, `ConfirmRegistrationView`, `frontend/app/accounts/signup/page.tsx` |
| Google login/onboarding | potpuno implementirano i aktivno | `backend/accounts/views.py:loginOrRegisterWithWGogleView`, `frontend/components/google-auth-button.tsx` |
| Login/logout/delete account | potpuno implementirano i aktivno | `backend/accounts/views.py:LoginView, logoutView, deleteUserView`, `frontend/components/login-form.tsx` |
| Profil studenta | potpuno implementirano i aktivno | `backend/users/views.py:my_student_profile`, `frontend/app/carefree/profile/student/page.tsx` |
| Profil stručnjaka i verifikacija | potpuno implementirano i aktivno | `backend/accounts/models.py:Caretaker`, `backend/accounts/views.py:CaretakerCompleteRegistrationView`, `frontend/app/carefree/profile/caretaker/page.tsx` |
| Admin odobrenje/odbijanje stručnjaka | potpuno implementirano i aktivno | `backend/accounts/admin.py:CaretakerAdmin.approve_caretakers/deny_caretakers` |
| Pretraga i filtriranje stručnjaka | potpuno implementirano i aktivno | `backend/users/views.py:search_caretakers`, `frontend/app/carefree/search/SearchPageClient.tsx` |
| Profili stručnjaka | potpuno implementirano i aktivno | `backend/users/views.py:caretaker_by_id`, `backend/users/serializers.py:CaretakerLongSerializer`, `frontend/app/carefree/caretaker/[id]/page.tsx` |
| Zahtjev za termin | potpuno implementirano i aktivno | `backend/appointments/views.py:AppointmentRequestCreateView`, `backend/appointments/services.py:create_appointment_request` |
| Odobravanje/odbijanje zahtjeva | djelomično implementirano | approve radi kroz `approve_appointment_request`; reject postoji, ali `backend/appointments/views.py:AppointmentRequestRejectView` koristi `settings.FRONTEND_URL` bez importa i grešku tiho proguta |
| Dostupnost stručnjaka | potpuno implementirano i aktivno | `backend/appointments/models.py:AvailabilitySlot`, `backend/appointments/views.py:CaretakerAvailabilityBulkSaveView`, `frontend/app/carefree/dostupnost/page.tsx` |
| Kalendari studenta i stručnjaka | potpuno implementirano i aktivno | `backend/appointments/views.py:MyCalendarView,CaretakerAppointmentListView`, `frontend/app/carefree/calendar/page.tsx`, `frontend/app/carefree/availability/page.tsx` |
| Google Meet/Calendar sync | djelomično implementirano | `backend/appointments/services.py:sync_create_google_event_sync`, `backend/calendar_integration/google_client.py:create_event`; ovisi o env i spremljenom credentialu |
| Dnevnik | potpuno implementirano i aktivno | `backend/journal/models.py:JournalEntry`, `backend/journal/views.py:JournalEntryViewSet`, `frontend/app/carefree/journal/page.tsx` |
| Feedback nakon termina | potpuno implementirano i aktivno | `backend/appointments/models.py:AppointmentFeedback`, `backend/appointments/views.py:AppointmentFeedbackUpsertView`, `frontend/components/student-dashboard.tsx` |
| Reservation hold | djelomično implementirano | backend i fetcher postoje u `backend/appointments/views.py:HoldCreateView`, `frontend/fetchers/appointments.ts:createHold`; aktivna booking stranica ih ne koristi |
| Stare signup forme | implementirano, ali se trenutačno ne koristi | `frontend/components/signup-user-form.tsx`, `signup-student-form.tsx`, `signup-caretaker-form.tsx`; koriste zastarjele endpoint/polja |

## D. Detaljna analiza AI/UI komponente "Julija"

| Element | Nalaz | Dokaz |
|---|---|---|
| Provider i model | OpenAI Chat Completions; default model `gpt-5.2-chat-latest`, fallback `gpt-4o-mini` | `backend/assistant/llm.py:_conversation_model,_backup_conversation_model,generate_assistant_result` |
| Pristup | Promptanje s JSON odgovorom; nije pronađen RAG, embeddings baza ni fine-tuning | `backend/assistant/prompts.py:build_system_prompt`, `backend/assistant/llm.py` |
| Sistemski prompt | Definira Juliju, ton, granice, krizni mod, kategorije i JSON shemu | `backend/assistant/prompts.py:build_system_prompt`, `backend/assistant/category_codes.py:CATEGORY_TREE` |
| Tijek podataka | frontend šalje poruku, backend sprema raw poruku, gradi kontekst, redigira user poruke, šalje OpenAI, parsira JSON, sprema bot poruku, ažurira sesiju i eventualno vraća preporuke | `frontend/app/carefree/messages/page.tsx`, `frontend/fetchers/assistant.ts`, `backend/assistant/views.py:SessionMessageView`, `backend/assistant/llm.py:build_messages_for_llm` |
| Podaci poslani OpenAI-u | sistemski prompt, redigirane studentske poruke, prethodni bot odgovori, prethodni sažeci, tihi podatak o spolu ako postoji | `backend/assistant/llm.py:build_messages_for_llm`, `backend/assistant/privacy.py:redact_message_payload` |
| Redakcija | regex redigira e-mail, telefon, URL, OIB, JMBAG, adresu; ne redigira imena i ne radi semantičku deidentifikaciju | `backend/assistant/privacy.py:redact_sensitive_text` |
| Rizik redakcije | stariji dio razgovora se sažima u system poruku, a redakcija se primjenjuje samo na role `user`; moguće curenje identifikatora iz starijeg sažetka | `backend/assistant/llm.py:_build_session_memory,build_messages_for_llm`, `backend/assistant/privacy.py:redact_message_payload` |
| Pohrana razgovora | raw poruke u `AssistantMessage`; sažeci i transcript snapshot u `AssistantSessionSummary`; kod preporuke se poruke brišu nakon spremanja snapshota | `backend/assistant/models.py`, `backend/assistant/session_flow.py:ensure_summary,close_session` |
| Preporuka stručnjaka | filtriranje odobrenih stručnjaka po `HelpCategory.assistant_code`; prioritet subkategorija, zatim glavna kategorija, zatim general fallback; random shuffle unutar grupa | `backend/assistant/recommendations.py:find_recommended_caretakers` |
| Krizni scenariji | prompt i fallback uključuju krizni mod, `danger_flag`, UI panel s kriznim kontaktima | `backend/assistant/prompts.py`, `backend/assistant/views.py:SessionMessageView`, `frontend/app/carefree/messages/page.tsx` |
| Predaja čovjeku | nema automatskog kontakta s čovjekom; predaja je kroz krizne kontakte i preporuku/booking stručnjaka | dokazivo odsutno iz `backend/assistant/views.py`, `backend/appointments/views.py` |
| Fallback | backup model, quota poruka i lokalni rule-based fallback | `backend/assistant/llm.py:generate_assistant_result,_fallback_result,_quota_exhausted_result` |

## E. Model podataka i životni ciklus podataka

| Podaci | Pohrana | Brisanje/retencija |
|---|---|---|
| Korisnici, studenti, stručnjaci | `backend/accounts/models.py:User,Student,Caretaker` | `backend/accounts/views.py:deleteUserView`; cascade odnosi i signali |
| Dokumenti stručnjaka | `CaretakerCV`, `Diploma`, `Certificate`, file storage | signali u `backend/accounts/signals.py` brišu stare datoteke best-effort |
| Dnevnik | `backend/journal/models.py:JournalEntry.content_encrypted` | korisnik može CRUD; nema opće retencijske politike |
| AI razgovori | `AssistantSession`, `AssistantMessage`, `AssistantSessionSummary` | manual end briše aktivnu sesiju; recommendation closure briše poruke, ali čuva summary/snapshot |
| Termini | `AppointmentRequest`, `Appointment`, `AppointmentFeedback` | nema aktivnog endpointa za otkazivanje termina; model `Appointment.cancel()` postoji |
| Google logovi | `CalendarEventLog.request_payload/response_payload` | nema retencijske politike; mogu sadržavati opis termina, e-mailove i Google payload |
| Lokalni artefakti | `backend/media`, `frontend/.next`, `generated/LOCAL_DEMO_CREDENTIALS.md` postoje u radnom stablu, ali nisu tracked | `.gitignore` ih ignorira; ne koristiti u radu bez redakcije |

## F. Autentifikacija, autorizacija, privatnost i sigurnost

| Nalaz | Status | Dokaz |
|---|---:|---|
| Globalno default dopuštenje je authenticated | potpuno implementirano i aktivno | `backend/backend/settings.py:REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES` |
| Role `student` i `caretaker` postoje na `User` | potpuno implementirano i aktivno | `backend/accounts/models.py:User.ROLE_CHOICES` |
| Specifične role-permissions postoje | potpuno implementirano i aktivno | `backend/accounts/permissions.py`, `backend/appointments/permissions.py` |
| JWT se vraća i u JSON payloadu i u httpOnly kolačićima | potpuno implementirano i aktivno, sigurnosni rizik | `backend/accounts/views.py:build_auth_response`, `frontend/lib/auth.ts:storeAuthTokens` |
| Frontend sprema tokene u `sessionStorage` | potpuno implementirano i aktivno, sigurnosni rizik pri XSS-u | `frontend/lib/auth.ts` |
| Tajne su predviđene kroz env varijable | potpuno implementirano kao konfiguracija | `backend/.env.example`, `backend/backend/settings.py`, `.gitignore` |
| Demo/operativne docs sadrže vjerodajnice | djelomično problematično | `DEMO_HANDOFF.md`, `WEEKLY_DEMO_RESET.md`, `SESSION_SUMMARY.md`, `scripts/DEMO_PSYCHOLOGISTS_CREDENTIALS.md`; sadržaj treba redigirati prije korištenja |
| Registracijski link se ispisuje u log | sigurnosni/privatnosni rizik | `backend/accounts/views.py:RequestRegistrationTokenView` |
| Upload validacija dokumenata provjerava ekstenziju/veličinu, ne potpunu MIME/content sigurnost | djelomično implementirano | `backend/accounts/validators.py`, `backend/accounts/serializers.py` |
| Journal sadržaj je šifriran Fernetom | potpuno implementirano i aktivno | `backend/journal/models.py:JournalEntry.content` |
| Journal export vraća dekriptirani sadržaj korisniku | potpuno implementirano i aktivno, osjetljivo | `backend/journal/views.py:JournalEntryViewSet.export` |
| External frontend script se učitava s treće domene | sigurnosni/privacy rizik | `frontend/app/layout.tsx` |
| TypeScript build errors se ignoriraju | kvalitativni rizik | `frontend/next.config.ts:typescript.ignoreBuildErrors` |
| `SystemGoogleConnectView` je `AllowAny` kad je user sync omogućen | potencijalni rizik | `backend/calendar_integration/views.py:SystemGoogleConnectView` |

## G. Deployment, testiranje i kvaliteta

| Područje | Nalaz | Dokaz |
|---|---|---|
| Backend deployment | Dockerfile za Python 3.12, gunicorn, kopira `backend` i `demo_profiles` | `Dockerfile` |
| Frontend deployment | Next build/start skripte, produkcijski fallback backend URL | `frontend/package.json`, `frontend/lib/config.ts` |
| CI/CD | nije pronađen GitHub workflow ni druga CI konfiguracija | repozitorijska pretraga `.github` i deployment datoteka |
| Backend testovi | statički pronađeno 47 `def test_` testova | `backend/accounts/tests.py`, `backend/assistant/tests.py`, `backend/appointments/tests.py`, `backend/journal/tests.py` |
| Frontend testovi | 2 suitea, 6 Jest testova | `frontend/fetchers/__tests__/fetcher.test.ts`, `frontend/fetchers/__tests__/users.test.ts` |
| Test dokumentacija | frontend docs aktualne; backend docs zastarjele jer navode 35 testova | `frontend/TEST_DOKUMENTACIJA.md`, `backend/TEST_DOKUMENTACIJA.md` |
| Poznati prototipni nedostaci | nema pokrenute provjere testova u ovom auditu; dio funkcionalnosti ovisi o vanjskim servisima i env vrijednostima | statički audit, `backend/accounts/management/commands/check_external_services.py` |
| Broken task | task za sažimanje appointment requesta referencira nepostojeći `assistant.services` | `backend/appointments/tasks.py:summarize_appointment_request`, ne postoji `backend/assistant/services.py` |

## H. Postojeća dokumentacija i grafike

| Materijal | Procjena | Napomena |
|---|---|---|
| `README.md` | djelomično aktualan | opisuje glavne module, ali navodi 35 backend testova i referencira `scripts/reset_local_app.sh`, koji nije pronađen |
| `DEPLOYMENT_GUIDE.md` | djelomično aktualan | koristan za Railway/Vercel/B2/Resend, ali callback path za Google u jednom dijelu ne odgovara aktivnom `/api/calendar/oauth/callback/`; cijene/hosting tvrdnje treba provjeriti izvan repoa |
| `EXTERNAL_SERVICES_SETUP.md` | djelomično aktualan | usklađen s OpenAI/Resend/Google/B2, ali tvrdnju da bez OpenAI assistant ne radi treba ublažiti jer postoji lokalni fallback |
| `backend/calendar_integration/README.md` | aktualan | poklapa se sa shared OAuth modelom i legacy per-user napomenom |
| `backend/appointments/README.md` | djelomično aktualan | opisuje holdove kao endpoint; frontend ih ne koristi u aktivnoj booking stranici |
| `backend/journal/README.md` | djelomično aktualan | opisuje enkripciju; export command dokumentacija nije potpuno precizna jer serializer vraća content |
| `CARETAKER_AVAILABILITY_FEATURE.md` | aktualan | poklapa se s `AvailabilitySlot`, 14 dana, 08-18 i bulk save |
| `frontend/CARETAKER_VERIFICATION.md` | aktualan | poklapa se s profile completion flowom |
| `frontend/TEST_DOKUMENTACIJA.md` | aktualan prema statičkom inventaru | 2 suitea, 6 testova |
| `backend/README_TESTOVI.md`, `backend/TEST_DOKUMENTACIJA.md` | zastarjelo | navode 35 backend testova, a kod sada ima 47 |
| `DEMO_HANDOFF.md`, `WEEKLY_DEMO_RESET.md`, `SESSION_SUMMARY.md`, `scripts/DEMO_PSYCHOLOGISTS_CREDENTIALS.md`, `generated/LOCAL_DEMO_CREDENTIALS.md` | osjetljivo, nije za izravno citiranje | sadrže operativne/demo podatke; potrebno redigirati |
| `frontend/public/images/*.png` | aktualno kao UI/email asseti | logo, assistant logo, email hero, emotikoni |
| `images/slika_1.jpeg`, `images/slika_2.jpeg` | nepoznato | slike postoje, ali nisu dokaz funkcionalnosti bez konteksta |
| `demo_profiles/*.jpg` | aktualno kao seed materijal | koristi ih `backend/accounts/management/commands/seed_demo_caretakers.py` i `Dockerfile` |
| `progi_CareFree_bundle/*` | uglavnom zastarjelo/planirano | sadrži stare promptove i istraživačke materijale; ne koristiti kao dokaz trenutne implementacije bez usporedbe s kodom |
| `za_eticko_povjerenstvo/*` | dokumentacija istraživanja, ne implementacija | sadrži studentske i psihološke evaluacijske materijale; korisno za etički/istraživački dio, ne za tvrdnje o kodu |

## I. Tablica dokazivih tvrdnji

| Tvrdnja | Status | Dokaz u repozitoriju | Putanja/simbol | Ograničenje | Poglavlje rada |
|---|---:|---|---|---|---|
| Sustav ima dvije korisničke uloge | potpuno implementirano i aktivno | model `User.role` | `backend/accounts/models.py:User` | nema treće role osim admina kroz Django | Arhitektura, Metode |
| Stručnjaci prolaze verifikaciju | potpuno implementirano i aktivno | approval status, admin akcije | `Caretaker.approval_status`, `CaretakerAdmin` | odluka je ručna | Sustav, Sigurnost |
| Pretraga vraća samo odobrene stručnjake | potpuno implementirano i aktivno | filter `is_approved=True` | `backend/users/views.py:search_caretakers` | stvarna kvaliteta matchinga nije evaluirana | Funkcionalnosti |
| AI koristi OpenAI Chat Completions | potpuno implementirano i aktivno | OpenAI client i `chat.completions.create` | `backend/assistant/llm.py` | stvarni API ključ nije provjeren | AI komponenta |
| AI nije RAG/fine-tuning | nepoznato izvan repoa, ali nema dokaza u kodu | nema vector store/fine-tune integracije | `backend/assistant/*` | vanjski OpenAI state nije provjeren | AI komponenta |
| AI preporuka je kategoričko filtriranje stručnjaka | potpuno implementirano i aktivno | `find_recommended_caretakers` | `backend/assistant/recommendations.py` | nema kliničke validacije | AI komponenta |
| Dnevnik se sprema enkriptirano | potpuno implementirano i aktivno | Fernet setter/getter | `backend/journal/models.py:JournalEntry.content` | ovisi o stabilnom `ENCRYPTION_KEY` | Podaci, Privatnost |
| Dnevnik ima kriznu heuristiku i AI sigurnosnu klasifikaciju | potpuno implementirano i aktivno | `_analysis_fields`, `classify_journal_safety` | `backend/journal/views.py`, `backend/journal/ai.py` | AI analiza je sync, ne Celery | AI, Sigurnost |
| Termini traju točno jedan sat | potpuno implementirano i aktivno | model validation | `AppointmentRequest.clean`, `Appointment.clean`, `AvailabilitySlot.clean` | nema multi-duration support | Funkcionalnosti |
| Google Meet se pokušava generirati pri approve flowu | djelomično implementirano | `sync_create_google_event_sync` | `backend/appointments/services.py` | ovisi o Google konfiguraciji | Deployment, Funkcionalnosti |
| Per-user Google sync je legacy/scaffold | implementirano, ali se trenutačno ne koristi | README i model refresh nedovršen | `backend/calendar_integration/models.py:GoogleCredential` | može biti aktiviran env postavkom, ali nije glavni tok | Arhitektura |
| Reservation hold endpoint postoji | djelomično implementirano | backend endpoint/fetcher | `HoldCreateView`, `frontend/fetchers/appointments.ts:createHold` | aktivna booking stranica ga ne poziva | Funkcionalnosti |
| Stari signup endpoint `/auth/register/user/` nije aktivan | implementirano, ali se trenutačno ne koristi | frontend poziv bez backend URL-a | `frontend/components/signup-user-form.tsx`, `backend/accounts/urls.py` | komponenta nije dokaz aktivnog toka | Kvaliteta |
| Backend test docs su zastarjele | samo dokumentirano ili planirano | docs navode 35, kod ima 47 testova | `backend/TEST_DOKUMENTACIJA.md`, `backend/*/tests.py` | testovi nisu pokrenuti | Kvaliteta |
| Repo sadrži osjetljivu demo dokumentaciju | djelomično problematično | tracked dokumenti s credential materijalom | `DEMO_HANDOFF.md`, `WEEKLY_DEMO_RESET.md`, `scripts/DEMO_PSYCHOLOGISTS_CREDENTIALS.md` | sadržaj ne treba citirati | Privatnost |
| Frontend ignorira TypeScript build greške | potpuno implementirano kao konfiguracija | `ignoreBuildErrors: true` | `frontend/next.config.ts` | ne znači nužno da postoje greške | Kvaliteta |
| Nema CI/CD workflowa | nepoznato izvan repoa, ali nije pronađeno u repou | nema `.github/workflows` | repozitorijska pretraga | vanjski CI nije provjeren | Deployment |

## J. Prijedlog grafika za rad

| Dijagram | Elementi dokazivi iz koda |
|---|---|
| Kontekstni dijagram sustava | Next frontend, Django API, PostgreSQL/SQLite, OpenAI, Resend/SMTP, Google Calendar, B2/local media; dokazi u `settings.py`, `frontend/lib/config.ts`, `backend/backend/emailing.py` |
| Komponentni dijagram backend aplikacija | `accounts`, `users`, `assistant`, `appointments`, `calendar_integration`, `journal`; dokazi u `INSTALLED_APPS` i URL konfiguraciji |
| Sekvencijski dijagram AI razgovora | `messages/page.tsx` -> `sendMessage` -> `SessionMessageView` -> `generate_assistant_result` -> OpenAI -> `find_recommended_caretakers` -> frontend preporuke |
| Sekvencijski dijagram bookinga | caretaker profile page -> `AppointmentRequestCreateView` -> `create_appointment_request` -> caretaker approve -> `approve_appointment_request` -> Google event/Meet |
| ER dijagram podataka | `User`, `Student`, `Caretaker`, `HelpCategory`, `AssistantSession`, `AssistantMessage`, `AssistantSessionSummary`, `JournalEntry`, `AppointmentRequest`, `Appointment`, `AppointmentFeedback`, `AvailabilitySlot` |
| Dijagram životnog ciklusa AI podataka | raw message, redaction prije OpenAI, summary/snapshot, optional transcript sharing u appointment requestu; dokazi u `assistant/session_flow.py`, `assistant/privacy.py`, `appointments/views.py` |
| Dijagram sigurnosnih granica | browser storage, httpOnly cookies, Django permissions, external providers, admin panel; dokazi u `frontend/lib/auth.ts`, `backend/backend/settings.py`, `backend/*/permissions.py` |
| Dijagram istraživačkog prototipa i ograničenja | aktivne funkcije naspram legacy/stale dijelova: old signup, per-user calendar sync, hold frontend gap, broken summary task; dokazi u gore navedenim putanjama |
