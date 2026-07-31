# Ciljani read-only audit repozitorija CareFree

Datum audita: 2026-06-28
Opseg: dodatni ciljani audit aktivnog koda i konfiguracije u lokalnom repozitoriju.
Ograničenje: nisu prikazane tajne, tokeni, API ključevi ni osobni podaci. Zaključci se temelje samo na dokazima u repozitoriju i lokalno pokrenutim provjerama.

Napomena: ovaj audit je povijesni snapshot prije kasnijeg sređivanja dokumentacije i repozitorijske strukture. Za aktualnu strukturu dokumentacije koristi `README.md` i `docs/README.md`.

## Statusi korišteni u izvještaju

- **potvrđeno**: tvrdnja je izravno dokaziva iz aktivnog koda, konfiguracije ili testnog izlaza.
- **djelomično**: dio toka postoji, ali nije potpun, nije pokriven aktivnim UI-jem ili ima poznatu grešku.
- **nije implementirano**: tražena funkcionalnost nije pronađena u aktivnom kodu.
- **nepoznato**: nije moguće dokazati bez vanjskog sustava, produkcijskih tajni, baze ili ručne provjere.

## 1. Aktualni produkcijski tok zahtjeva za termin

### Zaključak

Aktivni tok zahtjeva za termin ide s profila stručnjaka na frontend stranici `ShowCaretakerInfo`, šalje zahtjev na backend `AppointmentRequestCreateView`, a stručnjak zatim može prihvatiti ili odbiti zahtjev. Prihvaćanje stvara `Appointment`, pokušava sinkronizirati Google Calendar i šalje email. Odbijanje mijenja status zahtjeva, ali email obavijest ima grešku zbog korištenja `settings.FRONTEND_URL` bez importa `settings`. Aktivni frontend ne koristi `ReservationHold`, iako backend modeli, servisi i fetcheri za hold postoje.

### Status

**djelomično**

Tok slanja i prihvaćanja zahtjeva postoji i aktivan je. `ReservationHold` postoji, ali ga aktivni frontend ne koristi. Reject email tok je pokvaren. Cancel tok postoji na modelu i u taskovima, ali nije izložen kao aktivni endpoint u `appointments/urls.py`.

### Dokazi u kodu

- Frontend profil stručnjaka i booking forma: `frontend/app/carefree/caretaker/[id]/page.tsx:ShowCaretakerInfo` na liniji 106.
- Frontend uvoz koristi `getCaretakerSlots` i `createAppointmentRequest`, bez `createHold`: `frontend/app/carefree/caretaker/[id]/page.tsx` linija 9.
- Slanje zahtjeva: `frontend/app/carefree/caretaker/[id]/page.tsx:handleBooking` linija 284.
- Slanje `assistant_summary_id` i `share_full_transcript`: `frontend/app/carefree/caretaker/[id]/page.tsx` linije 299-302.
- Kontrola dijeljenja punog transkripta: `frontend/app/carefree/caretaker/[id]/page.tsx` linije 167 i 727.
- Fetcher za zahtjev: `frontend/fetchers/appointments.ts:createAppointmentRequest` linija 190.
- Fetcheri za hold postoje: `frontend/fetchers/appointments.ts:createHold` linija 225 i `releaseHold` linija 250.
- Backend hold endpointi postoje: `backend/appointments/views.py:HoldCreateView` linija 43 i `HoldReleaseView` linija 77.
- Backend hold servisi postoje: `backend/appointments/services.py:create_hold` linija 189 i `release_hold` linija 236.
- Model holda: `backend/appointments/models.py:ReservationHold` linija 230.
- Backend stvaranje zahtjeva: `backend/appointments/views.py:AppointmentRequestCreateView` linija 91.
- Servis stvaranja zahtjeva: `backend/appointments/services.py:create_appointment_request` linija 77.
- Serializer zahtjeva izlaže AI i transcript polja: `backend/appointments/serializers.py:AppointmentRequestSerializer` linija 32.
- Kartica zahtjeva za stručnjaka: `frontend/components/appointments/appointment-request-card.tsx`.
- Approve endpoint: `backend/appointments/views.py:AppointmentRequestApproveView` linija 190.
- Approve servis: `backend/appointments/services.py:approve_appointment_request` linija 242.
- Google payload za termin: `backend/appointments/google_sync.py:build_appointment_payload` linija 48.
- Reject endpoint: `backend/appointments/views.py:AppointmentRequestRejectView` linija 210.
- Reject razlog iz UI-ja: `frontend/components/appointments/appointment-request-card.tsx:rejectReason` linije 35 i 76.
- Model termina i metoda cancel: `backend/appointments/models.py:Appointment` linija 76.
- Task za cancel sinkronizaciju: `backend/appointments/tasks.py:sync_cancel_google_event`.
- Neispravan task za AI sažetak appointment requesta: `backend/appointments/tasks.py:summarize_appointment_request`, koji importira nepostojeći `assistant.services.summarize_text`.

### Što se šalje stručnjaku

**potvrđeno**

Backend u `AppointmentRequest` sprema i kroz serializer izlaže kombinaciju podataka:

- raw opis korisnika: `AppointmentRequest.message`;
- AI sažetak: `AppointmentRequest.ai_summary`;
- AI kategorija: `AppointmentRequest.ai_category`;
- crisis flag: `AppointmentRequest.crisis_flag`;
- transcript snapshot: `AppointmentRequest.ai_transcript_snapshot`, samo ako je `share_full_transcript=True`;
- oznaka da je transcript podijeljen: `AppointmentRequest.ai_transcript_shared`.

Dokazi: `backend/appointments/models.py:AppointmentRequest` linija 31, `backend/appointments/services.py:create_appointment_request` linija 77, `backend/appointments/serializers.py:AppointmentRequestSerializer` linija 32.

Email stručnjaku pri novom zahtjevu šalje raw poruku i osnovne podatke o terminu/studentu, ali ne šalje AI sažetak ili transcript u tijelu emaila. Dokaz: `backend/appointments/services.py:create_appointment_request` i `send_project_email` poziv oko linije 66.

Google Calendar opis termina koristi `ai_summary` ako postoji, inače raw `message`. Dokaz: `backend/appointments/google_sync.py:build_appointment_payload` linija 48.

### Kontrola korisnika nad dijeljenjem

**djelomično**

Korisnik može eksplicitno kontrolirati samo dijeljenje punog transkripta pomoću `shareFullTranscript`. Ako je odabran `AssistantSessionSummary`, frontend i dalje šalje `assistant_summary_id`; nije pronađena zasebna kontrola kojom korisnik može zabraniti dijeljenje AI sažetka, a istodobno koristiti prefill napomene.

### Greške i mrtve grane

- **potvrđeno**: aktivni frontend ne koristi `ReservationHold`, pa je hold tok djelomično mrtav za standardnog korisnika.
- **potvrđeno**: `AppointmentRequestRejectView` koristi `settings.FRONTEND_URL`, ali `settings` nije importan u `backend/appointments/views.py`; iznimka se proguta u `except Exception`, pa reject email vjerojatno tiho ne radi.
- **potvrđeno**: `reason = request.data.get('reason')` se čita u reject viewu, ali se ne sprema niti uključuje u email.
- **potvrđeno**: `summarize_appointment_request` referencira nepostojeći `assistant.services.summarize_text`.
- **djelomično**: cancel logika postoji na modelu i u tasku, ali aktivni API endpoint za cancel nije pronađen.

### Posljedica za znanstveni rad

Sigurna formulacija: "Prototip omogućuje slanje i prihvaćanje zahtjeva za termin, stvaranje termina, email obavijesti i pokušaj sinkronizacije s Google Calendarom. Mehanizam rezervacijskog holda postoji u backendu, ali nije povezan s aktivnim frontend tokom. Korisnik može kontrolirati dijeljenje punog transkripta, ali ne i odvojeno dijeljenje AI sažetka."

Ne treba tvrditi da je implementiran potpun produkcijski booking workflow s robusnim reject/cancel tokom ili aktivnim holdovima.

### Minimalni popravak prije predaje

- Dodati import `from django.conf import settings` u `backend/appointments/views.py` ili ukloniti ovisnost o `settings.FRONTEND_URL` iz reject email toka.
- Spremiti ili eksplicitno ukloniti `reason` iz reject toka.
- Ukloniti ili povezati `ReservationHold` u aktivni UI; u radu jasno navesti ako ostaje neaktivan.
- Dodati zasebnu korisničku kontrolu za dijeljenje AI sažetka.
- Popraviti ili ukloniti `summarize_appointment_request`.

## 2. Životni ciklus AI razgovora

### Zaključak

AI razgovor koristi tri glavna modela: `AssistantSession`, `AssistantMessage` i `AssistantSessionSummary`. Sesija nastaje pri pokretanju razgovora, svaka korisnička i bot poruka sprema se kao raw `AssistantMessage`, a sažetak nastaje kada LLM/fallback rezultat označi da ga treba pohraniti. Transcript snapshot u sažetku nastaje kao kopija raw poruka bez redakcije. Pri preporuci stručnjaka raw poruke se brišu nakon zatvaranja sesije, ali kod support/crisis zatvaranja ostaju. Ručni završetak sesije briše cijelu aktivnu sesiju i poruke.

### Status

**potvrđeno**

### Dokazi u kodu

- Model sesije: `backend/assistant/models.py:AssistantSession` linija 7.
- Model poruke: `backend/assistant/models.py:AssistantMessage` linija 73.
- Model sažetka: `backend/assistant/models.py:AssistantSessionSummary` linija 112.
- Start sesije: `backend/assistant/views.py:StartSessionView` linija 74.
- Slanje poruke i generiranje odgovora: `backend/assistant/views.py:SessionMessageView` linija 138.
- Ručni završetak: `backend/assistant/views.py:EndSesssionView` linija 100.
- Snapshot transkripta: `backend/assistant/session_flow.py:_build_transcript_snapshot` linija 7.
- Zatvaranje sesije: `backend/assistant/session_flow.py:close_session` linija 70.
- Stvaranje ili ažuriranje sažetka: `backend/assistant/session_flow.py:ensure_summary` linija 98.
- Kontekst prethodnih sažetaka: `backend/assistant/session_flow.py:recent_context_summaries` linija 19.

### Kada nastaju objekti

- `AssistantSession` nastaje u `StartSessionView` ako student nema aktivnu sesiju.
- `AssistantMessage` za korisnika nastaje u `SessionMessageView` prije poziva LLM-u ili fallbacku.
- `AssistantMessage` za bota nastaje nakon `generate_assistant_result`.
- `AssistantSessionSummary` nastaje ili se ažurira u `ensure_summary` kada rezultat ima `should_store_summary=True`.

### Kada se raw poruke brišu ili ostaju

- Pri recommendation closure: `close_session` briše `session.messages.all()` za `AssistantSession.ClosureReason.RECOMMENDATION`.
- Pri support i crisis closure: `close_session` ne briše raw poruke.
- Pri ručnom završetku: `EndSesssionView` briše postojeći summary ako postoji i zatim briše cijelu sesiju; cascade briše poruke.
- Pri odjavi: `backend/accounts/views.py:logoutView` briše/blacklista tokene i kolačiće, ali ne briše AI sesije ili poruke.
- Pri brisanju računa: `backend/accounts/views.py:deleteUserView` briše `User`; preko cascade veza brišu se `Student`, `AssistantSession`, `AssistantMessage` i `AssistantSessionSummary`.

### Transcript snapshot

**potvrđeno**

`_build_transcript_snapshot` sprema `sender`, `content`, `created_at` i `sequence` za sve poruke u sesiji. Ne poziva `redact_sensitive_text`, pa snapshot može sadržavati identifikatore ili sadržaj koji nije prošao redakciju.

### Posljedica za znanstveni rad

Sigurna formulacija: "Razgovori se vode kroz sesije i raw poruke, a za odabrane završetke generira se sažetak s opcionalnim snapshotom transkripta. Snapshot je tehnički kopija sadržaja poruka i ne prolazi kroz redakcijski sloj."

Ne treba tvrditi da se sav sirovi sadržaj automatski briše nakon završetka razgovora ili da su svi snapshoti anonimizirani.

### Minimalni popravak prije predaje

- Uvesti redakciju u `_build_transcript_snapshot`.
- Uskladiti politiku brisanja raw poruka za support/crisis closure.
- Jasno prikazati korisniku što ostaje spremljeno nakon završetka sesije.
- Preimenovati `EndSesssionView` u `EndSessionView` radi održivosti, uz kompatibilnost ruta ako je potrebno.

## 3. Redakcija i podaci poslani OpenAI-u

### Zaključak

OpenAI-u se šalju sistemski prompt, tihi podatak o spolu iz profila ako postoji, redigirani prethodni sažeci, dio trenutnog razgovora i ponekad sažetak starijeg dijela iste sesije. Redakcija regexima pokriva email, OIB, JMBAG, telefone, URL-ove i adrese, ali ne uklanja imena ni semantičke identifikatore. Redakcija se na kraju primjenjuje samo na poruke s ulogom `user`; bot poruke i sažetak starijeg dijela razgovora u `system` ulozi nisu redigirani istim završnim mehanizmom.

### Status

**djelomično**

Postoji redakcijski sloj, ali nije potpun i ne pokriva sve putove sadržaja.

### Dokazi u kodu

- Redakcija teksta: `backend/assistant/privacy.py:redact_sensitive_text` linija 15.
- Redakcija payload poruka: `backend/assistant/privacy.py:redact_message_payload` linija 30.
- Sastavljanje OpenAI poruka: `backend/assistant/llm.py:build_messages_for_llm` linija 483.
- OpenAI poziv: `backend/assistant/llm.py:generate_assistant_result` linija 538.
- Sistemski prompt: `backend/assistant/prompts.py:build_system_prompt`.
- Journal OpenAI klasifikacija: `backend/journal/ai.py:classify_journal_safety` linija 18.
- Journal view analiza: `backend/journal/views.py:JournalEntryViewSet._analysis_fields` linija 40.
- Journal safety heuristika i rate limit: `backend/journal/safety.py:looks_like_crisis_content` linija 43 i `journal_analysis_allowed` linija 48.

### Polja koja mogu biti poslana OpenAI-u

| Polje / sadržaj | Izvor | Redakcija | Format |
|---|---|---|---|
| Sistemski prompt | `backend/assistant/prompts.py:build_system_prompt` | nema osobnih podataka iz korisnika | `system` poruka |
| Spol iz profila | `session.student.user.sex` u `build_messages_for_llm` | nema redakcije | `system` poruka s vrijednošću spola |
| Prethodni sažeci | `recent_context_summaries(student)` | `redact_sensitive_text` po stavci | `system` poruka |
| Stariji dio iste sesije | `_build_session_memory(older_messages)` | nije potvrđena redakcija u finalnom `redact_message_payload`, jer je dodano kao `system` poruka | `system` poruka |
| Recent korisničke poruke | `AssistantMessage.content`, sender student | `redact_message_payload` redigira `role == "user"` | `user` poruke |
| Recent bot poruke | `AssistantMessage.content`, sender bot | ne redigira ih završni `redact_message_payload` | `assistant` poruke |
| Journal naslov i sadržaj | `JournalEntryViewSet._analysis_fields` | `classify_journal_safety` poziva `redact_sensitive_text` | prompt s tekstom dnevničkog zapisa |

### Stariji sažetak i neredigirani identifikatori

**djelomično potvrđeno**

Prethodni spremljeni sažeci prolaze kroz `redact_sensitive_text` prije slanja u OpenAI. Međutim, ako stariji sažetak sadrži imena ili semantičke identifikatore koje regex ne prepoznaje, oni mogu ostati. Dodatno, sažetak starijeg dijela iste aktivne sesije koji nastaje kroz `_build_session_memory(older_messages)` ulazi kao `system` poruka i nije pokriven završnom redakcijom `redact_message_payload`, koja redigira samo `role == "user"`.

### Dnevnik i OpenAI

**potvrđeno**

Dnevnički unos može biti poslan OpenAI-u samo ako:

- sadržaj ne pogodi determinističku kriznu heuristiku `looks_like_crisis_content`;
- `journal_analysis_allowed(user.id)` dopusti analizu prema rate limitu;
- `_run_ai_analysis` pozove `classify_journal_safety`.

Ako heuristika prepozna krizu, OpenAI se ne zove u tom putu i sprema se `CRISIS_SUPPORT_NOTE`.

### Posljedica za znanstveni rad

Sigurna formulacija: "Sustav primjenjuje regex-redakciju na dio sadržaja koji se šalje modelu, ali redakcija nije potpuna anonimizacija. Imena i semantički identifikatori mogu ostati, a neki sistemski konteksti nisu pokriveni završnim redakcijskim korakom."

Ne treba tvrditi da je sustav anonimiziran ili da se osobni podaci nikad ne šalju pružatelju modela.

### Minimalni popravak prije predaje

- Redigirati sve role, uključujući `system` sažetke koji sadrže korisnički sadržaj.
- Uvesti posebnu redakciju za imena ili barem explicitno dokumentirati da se imena ne uklanjaju.
- Dodati testove za redakciju bot poruka, starijih sažetaka i journal unosa.
- U UI dodati obavijest da dnevnik može biti analiziran AI-em ako je funkcija uključena.

## 4. Krizni tok

### Zaključak

Krizni tok postoji kroz kombinaciju sistemskog prompta, modelskog `danger_flag`, lokalnog fallback prepoznavanja u assistant modulu i determinističke provjere dnevnika. Korisniku se prikazuju kontakti za hitnu pomoć i krizne linije. Nije pronađena automatska obavijest stručnjaku, administratoru ili hitnoj službi. `danger_flag` se sprema na AI sesiji, a `crisis_flag` se može prenijeti u zahtjev za termin.

### Status

**djelomično**

Prepoznavanje i UI upozorenja postoje, ali nema automatske eskalacije prema ljudskom akteru.

### Dokazi u kodu

- Sistemski prompt i krizne upute: `backend/assistant/prompts.py:build_system_prompt`.
- Assistant fallback: `backend/assistant/llm.py:_fallback_result` i `_crisis_fallback_result`.
- Modelski rezultat i `danger_flag`: `backend/assistant/llm.py:generate_assistant_result` linija 538.
- Spremanje danger flagova na sesiji: `backend/assistant/session_flow.py:update_session_from_result`.
- UI hint s kriznim kontaktima: `backend/assistant/views.py:_session_intro_payload`.
- Frontend default UI hint: `frontend/app/carefree/messages/page.tsx:defaultUiHint` linija 77.
- Frontend prikaz `danger_flag` upozorenja: `frontend/app/carefree/messages/page.tsx` linije 750-759.
- Journal krizni tekstovi: `backend/journal/safety.py:CRISIS_PATTERNS` linija 11 i `CRISIS_SUPPORT_NOTE` linija 6.
- Journal UI krizni tekst: `frontend/app/carefree/journal/page.tsx` linija 207.
- Appointment crisis flag: `backend/appointments/models.py:AppointmentRequest` linija 31 i `backend/appointments/services.py:create_appointment_request` linija 77.

### Kontakti i tekstovi

U kodu se prikazuju ovi kontakti:

- Hitna pomoć: `112`.
- Centar za krizna stanja i prevenciju suicida: `01 2376 335`.
- Plavi telefon: `01 4833 888`.

Primjer frontend teksta: `frontend/app/carefree/messages/page.tsx` prikazuje upozorenje "Ako si sada u neposrednoj opasnosti ili misliš da bi si mogao/la nauditi, odmah potraži pomoć." i zatim navedene kontakte.

### Automatska obavijest

**nije implementirano**

Nije pronađen kod koji pri `danger_flag`, `crisis_flag` ili journal `crisis_detected` automatski obavještava stručnjaka, administratora ili hitnu službu. Jedini put kojim stručnjak može vidjeti kriznu oznaku je ako korisnik sam pošalje zahtjev za termin koji nosi `crisis_flag`.

### Tko vidi flag

- Korisnik vidi UI upozorenje u assistant i journal sučelju.
- Stručnjak može vidjeti `crisis_flag` u appointment request UI-ju ako postoji zahtjev za termin s kriznim summaryjem.
- Admin može vidjeti modele ako su registrirani u Django adminu; za assistant admin postoje registracije u `backend/assistant/admin.py`.

### Rizik zastarjelih kontakata

**nepoznato**

Kontakti su hardkodirani na više mjesta i u repozitoriju nema izvora, datuma provjere ili automatizirane validacije aktualnosti. Bez vanjske provjere nije moguće potvrditi jesu li brojevi aktualni.

### Posljedica za znanstveni rad

Sigurna formulacija: "Sustav prepoznaje krizne indikatore i prikazuje krizne kontakte korisniku, ali ne provodi automatsku obavijest trećim stranama."

Ne treba tvrditi da sustav ima klinički protokol eskalacije ili aktivno obavještavanje hitnih službi.

### Minimalni popravak prije predaje

- Centralizirati krizne kontakte u jednu konfiguraciju.
- Dodati izvor i datum provjere kontakata.
- U radu jasno napisati da nema automatske eskalacije.
- Razmotriti administratorski pregled kriznih flagova samo ako postoji pravna i etička osnova.

## 5. Autentifikacija i sigurnost

### Zaključak

Backend podržava i JWT u JSON payloadu i httpOnly kolačiće. Frontend se i dalje oslanja na `sessionStorage` tokene i `Authorization: Bearer`, pa prelazak na cookie-only autentifikaciju nije samo backend promjena. Produkcijske sigurnosne postavke za cookies, CSRF, CORS i HTTPS postoje u konfiguraciji, ali stvarno ponašanje ovisi o environment varijablama. `SystemGoogleConnectView` je `AllowAny`, ali se odmah gasi ako je `ENABLE_USER_GOOGLE_CALENDAR_SYNC` false; ako se omogući, endpoint za pokretanje shared Google OAuth toka nije zaštićen admin dozvolom.

### Status

**djelomično**

### Dokazi u kodu

- Auth response s JSON tokenima i cookies: `backend/accounts/views.py:build_auth_response` linija 104.
- Cookie parametri: `backend/accounts/views.py:_auth_cookie_kwargs` linija 85.
- Refresh endpoint: `backend/accounts/views.py:refresh_access_token_view` linija 905.
- Cookie JWT auth: `backend/accounts/authentication.py:CookieJWTAuthentication` linija 3.
- DRF auth classes: `backend/backend/settings.py:DEFAULT_AUTHENTICATION_CLASSES` linija 148.
- Cookie security defaults: `backend/backend/settings.py:SESSION_COOKIE_SECURE` linija 330 i `SESSION_COOKIE_SAMESITE` linija 332.
- CORS credentials: `backend/backend/settings.py:CORS_ALLOW_CREDENTIALS` linija 291.
- CORS allowed origins: `backend/backend/settings.py:CORS_ALLOWED_ORIGINS` linija 299.
- CORS regex: `backend/backend/settings.py:CORS_ALLOWED_ORIGIN_REGEXES` linije 305-306.
- CSRF trusted origins: `backend/backend/settings.py:CSRF_TRUSTED_ORIGINS` linija 314.
- Frontend auth storage: `frontend/lib/auth.ts`.
- System Google OAuth start: `backend/calendar_integration/views.py:SystemGoogleConnectView` linija 403.
- Google OAuth callback: `backend/calendar_integration/views.py:GoogleOAuthCallbackView` linija 267.

### Zašto se JWT vraća u JSON payloadu i sprema u sessionStorage uz httpOnly cookies

**nepoznato / djelomično dokazivo**

Kod dokazuje da backend vraća tokene i u JSON-u i u cookies, a frontend ih sprema u `sessionStorage` i šalje kroz `Authorization: Bearer`. Nije pronađen komentar ili dokument koji objašnjava arhitekturnu odluku. Sigurna interpretacija za rad je da prototip održava hibridni model autentifikacije radi kompatibilnosti frontend fetchera, ali ne treba tvrditi motiv bez dokaza.

### Frontend dijelovi koji ovise o sessionStorage tokenu

**potvrđeno**

- `frontend/lib/auth.ts`: `getAccessToken`, `getRefreshToken`, `storeAuthTokens`, `clearAuthTokens`, `authFetch`.
- `frontend/fetchers/fetcher.ts`: zajednički fetcher.
- `frontend/fetchers/users.ts`.
- `frontend/fetchers/assistant.ts`.
- `frontend/fetchers/appointments.ts`.
- `frontend/components/login-form.tsx`.
- `frontend/components/google-auth-button.tsx`.
- Stranice koje preko fetchera koriste `authFetch`, uključujući profile, dostupnost, poruke, dnevnik i termine.

### Može li se prije predaje prijeći samo na cookie autentifikaciju

**djelomično**

Backend već ima cookie auth i refresh cookie tok, ali frontend je široko vezan na `sessionStorage` i `Authorization` header. Prijelaz je moguć bez velike backend rekonstrukcije, ali nije siguran kao zadnja promjena bez regresijskih i E2E testova, posebno zbog cross-site cookies između Vercel frontenda i Railway backenda.

### Secure, HttpOnly, SameSite, CSRF, CORS

**potvrđeno iz konfiguracije**

- Cookies su `httponly=True` u `_auth_cookie_kwargs`.
- `secure` ovisi o `SESSION_COOKIE_SECURE`, koji defaultno prati `IS_PRODUCTION`.
- `samesite` defaultno je `"None"` u produkciji, `"Lax"` lokalno.
- `CORS_ALLOW_CREDENTIALS=True`.
- Default CORS origine uključuju Vercel i Railway domene te localhost.
- Regex dopušta `programsko-inzenjerstvo*.vercel.app` i `carefree*.vercel.app`.
- CSRF trusted origins uključuju Vercel i `https://*.railway.app`, a `FRONTEND_URL` se dodaje ako je postavljen.

Stvarne produkcijske vrijednosti environment varijabli nisu provjerene jer bi to zahtijevalo pristup tajnama ili runtime okruženju.

### SystemGoogleConnectView

**djelomično**

`SystemGoogleConnectView` ima `permission_classes = [AllowAny]`. Ako je `ENABLE_USER_GOOGLE_CALENDAR_SYNC` false, vraća 410 i tok je efektivno isključen. Ako je omogućeno i OAuth varijable postoje, endpoint vraća Google consent URL i sprema state u cache. Callback također ima `AllowAny` i sprema `SystemGoogleCredential` ako se zadovolje uvjeti očekivanog Google računa.

Rizik: ako je feature flag uključen, bilo tko može pokrenuti shared Google connect tok. Minimalno bi trebalo zahtijevati admin autentifikaciju ili jednokratni setup token.

### Posljedica za znanstveni rad

Sigurna formulacija: "Autentifikacija koristi JWT i podržava httpOnly cookies, ali aktivni frontend još koristi sessionStorage i Bearer tokene. Produkcijska sigurnost cookies i CORS-a ovisi o konfiguraciji environment varijabli."

Ne treba tvrditi da je sustav u potpunosti cookie-only ili da je CSRF model produkcijski verificiran.

### Minimalni popravak prije predaje

- Dokumentirati razlog hibridne autentifikacije ili prijeći na jedan model.
- Ako se prelazi na cookie-only, prvo dodati E2E testove login/refresh/logout toka.
- Zaštititi `SystemGoogleConnectView` admin dozvolom ili setup tokenom.
- Ograničiti CORS regexe na stvarne produkcijske domene.

## 6. Pohrana, retencija i brisanje

### Zaključak

Repozitorij sadrži više modela koji mogu pohraniti osjetljiv ili psihološki sadržaj: AI poruke i sažetke, dnevnike, zahtjeve za termin, appointment feedback, Google payload logove, dokumente stručnjaka i OAuth tokene. Brisanje korisničkog računa briše velik dio korisnički vezanih podataka preko cascade veza, ali appointment requestovi i appointmenti mogu ostati sa `student=NULL`, a calendar logovi mogu ostati zbog `SET_NULL`. Nije pronađena eksplicitna opća retencijska politika.

### Status

**djelomično**

### Modeli i logovi s potencijalno osjetljivim sadržajem

| Model / log | Potencijalno osjetljiv sadržaj | Brisanje / cascade | Retencija |
|---|---|---|---|
| `accounts.User` | email, ime, prezime, dob, spol, Google identitet | `deleteUserView` briše usera | nema eksplicitne retencije |
| `accounts.Student` | fakultet, godina, anonimnost | `User` -> `Student` cascade | nema eksplicitne retencije |
| `accounts.Caretaker` | profil stručnjaka, telefon, slika, opis | `User` -> `Caretaker` cascade | nema eksplicitne retencije |
| `accounts.CaretakerCV` | CV dokument | FK na `Caretaker`, file cleanup signal | nema eksplicitne retencije |
| `accounts.Diploma` | dokument diplome | FK na `Caretaker`, file cleanup signal | nema eksplicitne retencije |
| `accounts.Certificate` | certifikat | FK na `Caretaker`, file cleanup signal | nema eksplicitne retencije |
| `assistant.AssistantSession` | kategorije, status, danger flag | FK `Student` cascade | nema eksplicitne retencije |
| `assistant.AssistantMessage` | raw AI razgovor | FK `AssistantSession` cascade; dio se briše pri recommendation closure | nema opće retencije |
| `assistant.AssistantSessionSummary` | sažetak, kategorije, raw transcript snapshot | FK `Student` cascade; session `SET_NULL` | nema opće retencije |
| `journal.JournalEntry` | naslov, šifrirani sadržaj, mood, AI analiza, crisis flag | FK `User` cascade | nema opće retencije |
| `appointments.AppointmentRequest` | raw opis, AI sažetak, transcript snapshot, crisis flag | student `SET_NULL`, caretaker cascade | nema opće retencije |
| `appointments.Appointment` | termin, Meet link, cancellation metadata | student `SET_NULL`, caretaker cascade, request cascade | nema opće retencije |
| `appointments.AppointmentFeedback` | ocjena i komentar | FK `Appointment` cascade | nema opće retencije |
| `appointments.CalendarEventLog` | Google request/response payload, opisi, attendeeji | appointment `SET_NULL` | nema opće retencije |
| `calendar_integration.CalendarEvent` | raw Google event payload | calendar cascade | nema opće retencije |
| `calendar_integration.GoogleCredential` | OAuth tokeni i client secret | model cleanup nije potvrđen za user delete u ovom auditu | nema opće retencije |
| `calendar_integration.SystemGoogleCredential` | shared OAuth tokeni | ručno/konfiguracijski | nema opće retencije |
| `calendar_integration.ReconcileLog` | diff lokalnog i Google stanja | calendar `SET_NULL` | nema opće retencije |

### Dokazi u kodu

- Account modeli: `backend/accounts/models.py:User` linija 42, `Student` linija 81, `Caretaker` linija 99, `CaretakerCV` linija 237, `Certificate` linija 251, `Diploma` linija 262, `HelpCategory` linija 284.
- Upload polja: `backend/accounts/models.py` linije 144, 242, 253 i 274.
- File cleanup signali: `backend/accounts/signals.py` linije 89, 98, 156, 168, 179, 189 i 199.
- Delete account: `backend/accounts/views.py:deleteUserView` linija 812.
- Assistant modeli: `backend/assistant/models.py` linije 7, 73 i 112.
- Journal model: `backend/journal/models.py:JournalEntry` linija 5, `content_encrypted` linija 16.
- Appointment modeli: `backend/appointments/models.py:AppointmentRequest` linija 31, `Appointment` linija 76, `AppointmentFeedback` linija 130, `CalendarEventLog` linija 172.
- Calendar integration modeli: `backend/calendar_integration/models.py:Calendar` linija 6, `CalendarEvent` linija 15, `GoogleCredential` linija 32, `SystemGoogleCredential` linija 116, `ReconcileLog` linija 255.

### Briše li delete account sve povezane podatke i datoteke

**djelomično**

`deleteUserView` briše `User`, čime se preko cascade veza brišu student/caretaker profil, assistant podaci i journal podaci. Za caretaker dokumente postoje file cleanup signali. Međutim, `AppointmentRequest.student` i `Appointment.student` koriste `SET_NULL`, pa zapisi mogu ostati bez studenta. `CalendarEventLog` koristi `SET_NULL` na appointmentu, pa logovi mogu ostati i nakon brisanja povezanog appointmenta. Nije potvrđeno da se vanjski Google Calendar event briše pri brisanju korisničkog računa.

### Posljedica za znanstveni rad

Sigurna formulacija: "Sustav koristi cascade brisanje za dio korisničkih podataka, ali ne implementira potpunu retencijsku politiku niti garantira uklanjanje svih izvedenih zapisa i vanjskih kalendarskih događaja pri brisanju računa."

Ne treba tvrditi da delete account provodi potpuno pravo na brisanje u smislu svih logova i vanjskih servisa.

### Minimalni popravak prije predaje

- Uvesti eksplicitnu retencijsku politiku za AI poruke, sažetke, dnevnike, appointment requestove i calendar logove.
- Pri delete accountu anonimizirati ili brisati `AppointmentRequest`/`Appointment` zapise vezane uz studenta.
- Očistiti `CalendarEventLog` ili redigirati payload.
- Provjeriti i dokumentirati brisanje vanjskih Google Calendar događaja.

## 7. Testovi i aktualna kvaliteta

### Zaključak

Backend i frontend testovi prolaze u lokalnom testnom okruženju. TypeScript provjera i ESLint prolaze bez grešaka. Nije pokrenut `next build` jer bi generirao `.next` artefakte u repozitoriju; za read-only audit pokrenut je `tsc --noEmit` kao sigurnija provjera bez build outputa.

### Status

**potvrđeno**

### Pokrenute provjere

| Provjera | Komanda | Rezultat |
|---|---|---|
| Backend Django testovi | `env -u DATABASE_URL -u OPENAI_API_KEY -u GOOGLE_SERVICE_ACCOUNT_JSON -u GOOGLE_SERVICE_ACCOUNT_FILE -u GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL -u GOOGLE_CALENDAR_ID -u B2_KEY_ID -u B2_APPLICATION_KEY -u B2_BUCKET_NAME -u B2_ENDPOINT -u B2_REGION PYTHONDONTWRITEBYTECODE=1 APP_ENV=test DEBUG=True ./.venv/bin/python manage.py test --noinput -v 2` u `backend/` | 47 testova, 47 prošlo, 0 palo, 0 preskočeno |
| Frontend Jest | `CI=1 pnpm test -- --runInBand --no-cache` u `frontend/` | 2 test suitea, 6 testova, 6 prošlo, 0 palo, 0 preskočeno |
| TypeScript | `pnpm exec tsc --noEmit --incremental false` u `frontend/` | exit 0, bez grešaka |
| ESLint | `pnpm exec eslint .` u `frontend/` | exit 0, bez grešaka |

### Ograničenja provjere

- Django testovi koristili su testnu SQLite memorijsku bazu.
- `settings.py` učitava `.env`, pa samo unsetanje varijabli u shellu ne garantira da se tajne iz `.env` neće učitati. U jednom testnom putu pokušaj OpenAI poziva završio je DNS/network greškom i fallback je prošao; tajne nisu prikazane.
- `next build` nije pokrenut jer generira build artefakte.
- Nije pronađen CI workflow u `.github/workflows`.

### Posljedica za znanstveni rad

Sigurna formulacija: "U lokalnom testnom okruženju prolaze postojeći backend i frontend testovi te statičke frontend provjere, ali opseg testova je ograničen i ne dokazuje produkcijsku pouzdanost integracija s OpenAI-em, emailom i Google Calendarom."

### Minimalni popravak prije predaje

- Dodati testove za reject/cancel appointment tok.
- Dodati testove za redakciju AI payloadova i transcript snapshot.
- Dodati test za to da aktivni booking UI koristi ili namjerno ne koristi `ReservationHold`.
- Dodati CI workflow koji pokreće backend testove, frontend testove, TypeScript i lint.

## 8. Deployment i vanjske integracije

### Zaključak

Backend je pripremljen za deployment kroz `Dockerfile` i konfiguraciju preko environment varijabli. Baza koristi `DATABASE_URL` ako postoji, inače SQLite. Email koristi Resend ako je konfiguriran, inače SMTP backend. Google Calendar koristi shared OAuth credential ako je postavljen shared account, inače service account konfiguraciju. Media storage u produkciji može koristiti B2/S3 kompatibilni storage ako su sve B2 varijable postavljene, inače local filesystem. Frontend očekuje backend URL kroz public env varijable i ima produkcijski fallback na Railway URL.

### Status

**djelomično**

Konfiguracija je potvrđena u kodu. Stvarno produkcijsko stanje nije potvrđeno jer nisu provjeravane tajne ni runtime environment.

### Dokazi u kodu

- Docker deployment backend: `Dockerfile`.
- Baza: `backend/backend/settings.py:DATABASE_URL` linija 231 i `dj_database_url.parse` linije 232-235.
- Email provider: `backend/backend/emailing.py:send_project_email` linija 73 i Resend grana linije 20, 91-93.
- SMTP default: `backend/backend/settings.py:EMAIL_BACKEND` linija 98.
- Resend key konfiguracija: `backend/backend/settings.py:RESEND_API_KEY` linija 106.
- Google service account: `backend/backend/settings.py:GOOGLE_SERVICE_ACCOUNT_JSON` linija 355 i `GOOGLE_SERVICE_ACCOUNT_FILE` linija 356.
- Shared Google calendar account: `backend/backend/settings.py:GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL` linija 373.
- Google service builder: `backend/calendar_integration/google_client.py:build_service` linija 104.
- B2/S3 storage: `backend/backend/settings.py` linije 378-393.
- Frontend backend URL: `frontend/lib/config.ts`.
- Safe external check command: `backend/accounts/management/commands/check_external_services.py`.
- Dokumentacija Google integracije: `backend/calendar_integration/README.md`.

### Konfigurirano, lokalno, produkcija, dokumentirano

| Komponenta | Konfigurirano u kodu | Lokalno | Produkcija | Samo dokumentirano |
|---|---|---|---|---|
| Baza | `DATABASE_URL` ili SQLite fallback | SQLite fallback ako nema env | vjerojatno `DATABASE_URL`, ali nije runtime potvrđeno | ne |
| Email | SMTP/Resend | ovisi o env | ovisi o env | djelomično u setup dokumentima |
| Google Calendar | shared OAuth ili service account | ovisi o env i credentialu | ovisi o env i stored credentialu | `calendar_integration/README.md` |
| Media storage | local ili B2/S3 | local ako `USE_CLOUD_MEDIA=False` ili nema B2 env | B2/S3 samo ako su sve varijable postavljene | djelomično |
| OpenAI | konfiguriran kroz assistant/journal kod | ovisi o env | ovisi o env | djelomično |
| Frontend hosting | Next.js konfiguracija | local dev | Vercel domene u CORS-u i frontend configu | nema punog Vercel config fajla |

### Health-check ili safe command

**potvrđeno**

Postoji `backend/accounts/management/commands/check_external_services.py`, koji provjerava konfiguraciju OpenAI-a, emaila, Google Calendara i B2 storagea bez namjernog ispisa tajni. U ovom auditu nije pokrenut protiv stvarnog produkcijskog environmenta.

### Posljedica za znanstveni rad

Sigurna formulacija: "Sustav je konfiguracijski pripremljen za vanjske integracije s bazom, email providerom, Google Calendarom, OpenAI-em i B2/S3 pohranom, ali produkcijsko korištenje pojedine integracije ovisi o environment varijablama i nije dokazivo samo iz repozitorija."

Ne treba tvrditi da se određena vanjska usluga stvarno koristi u produkciji bez runtime dokaza.

### Minimalni popravak prije predaje

- Dodati dokumentiranu matricu environment varijabli za produkciju bez tajni.
- Pokrenuti `check_external_services` u sigurnom staging/production okruženju i spremiti rezultat bez tajni izvan repozitorija ili u internu evidenciju.
- Dodati CI/CD konfiguraciju ako se želi tvrditi automatizirani deployment.

## 9. Aktualni model podataka

### Zaključak

Aktualni ER dijagram treba temeljiti na Django modelima u aplikacijama `accounts`, `assistant`, `journal`, `appointments` i `calendar_integration`. Glavna domena su korisnici/studenti/stručnjaci, AI sesije i poruke, dnevnik, zahtjevi za termin i termini. Pomoćni/log modeli uključuju dokumente stručnjaka, calendar logove, OAuth credentiale i reconcile logove. `ReservationHold` i `Availability` postoje u kodu, ali aktivni frontend koristi slotove i ne koristi hold.

### Status

**potvrđeno**

### Glavna domenska jezgra

| Model | Uloga | Ključne veze |
|---|---|---|
| `accounts.User` | zajednički korisnički račun | `Student`, `Caretaker`, `JournalEntry` |
| `accounts.Student` | studentski profil | FK/OneToOne prema `User`; veze prema assistant i appointment modelima |
| `accounts.Caretaker` | stručnjak | FK/OneToOne prema `User`; M2M `HelpCategory`; appointment i availability veze |
| `accounts.HelpCategory` | kategorije pomoći | M2M s `Caretaker`; koristi se u preporukama i profilima |
| `assistant.AssistantSession` | aktivna ili završena AI sesija | FK `Student`; ima `AssistantMessage`; povezana sa summaryjem |
| `assistant.AssistantMessage` | raw poruka razgovora | FK `AssistantSession` |
| `assistant.AssistantSessionSummary` | AI sažetak i preporuka | FK `Student`; OneToOne `AssistantSession` uz `SET_NULL` |
| `journal.JournalEntry` | dnevnički unos | FK `User` |
| `appointments.AppointmentRequest` | zahtjev za termin | FK `Student` `SET_NULL`; FK `Caretaker`; može sadržati AI kontekst |
| `appointments.Appointment` | dogovoreni termin | FK `Student` `SET_NULL`; FK `Caretaker`; FK `AppointmentRequest` |
| `appointments.AppointmentFeedback` | feedback termina | FK `Appointment`; FK reviewer/reviewee user |
| `appointments.AvailabilitySlot` | dostupni slot stručnjaka | FK `Caretaker` |

### Pomoćni, dokumentacijski i log modeli

| Model | Uloga |
|---|---|
| `accounts.CaretakerCV` | CV dokument stručnjaka |
| `accounts.Diploma` | diploma stručnjaka |
| `accounts.Certificate` | certifikat stručnjaka |
| `appointments.Availability` | stariji ili paralelni model dostupnosti; treba označiti kao neosnovni ako nije aktivan u UI-ju |
| `appointments.ReservationHold` | rezervacijski hold; backend postoji, aktivni frontend ga ne koristi |
| `appointments.CalendarEventLog` | log Google Calendar create/update/cancel operacija |
| `calendar_integration.Calendar` | lokalni zapis kalendara |
| `calendar_integration.CalendarEvent` | lokalna kopija Google eventa |
| `calendar_integration.GoogleCredential` | per-user Google OAuth credential scaffold/legacy |
| `calendar_integration.SystemGoogleCredential` | shared Google OAuth credential |
| `calendar_integration.ReconcileLog` | log usklađivanja lokalnog i Google kalendara |

### Dokazi u kodu

- `backend/accounts/models.py`
- `backend/assistant/models.py`
- `backend/journal/models.py`
- `backend/appointments/models.py`
- `backend/calendar_integration/models.py`

### Posljedica za znanstveni rad

Sigurna formulacija: "ER dijagram treba prikazati korisničke profile, stručnjake, AI sesije i sažetke, dnevnike, zahtjeve za termin, termine i integracijske logove, uz jasnu oznaku pomoćnih i neaktivnih modela."

Ne treba uključivati modele iz stare dokumentacije ako ih nema u Django modelima ili aktivnim migracijama.

### Minimalni popravak prije predaje

- Označiti `ReservationHold` i `Availability` kao djelomično ili neaktivno korištene ako ostaju u dijagramu.
- Dodati polja koja nose osjetljive podatke u privacy/retention dijagram.

## 10. Završna tablica za rad

| Tvrdnja za znanstveni rad | Sigurna formulacija | Dokaz | Ograničenje | Treba li popravak prije predaje | Prioritet |
|---|---|---|---|---|---|
| Sustav omogućuje zahtjev za termin | Prototip omogućuje slanje zahtjeva za termin iz profila stručnjaka i backend spremanje zahtjeva | `frontend/app/carefree/caretaker/[id]/page.tsx:ShowCaretakerInfo`; `backend/appointments/views.py:AppointmentRequestCreateView`; `backend/appointments/services.py:create_appointment_request` | reject/cancel tok nije potpun | da | visoko |
| Sustav koristi rezervacijski hold | Backend i fetcheri za hold postoje, ali aktivni frontend booking tok ih ne koristi | `backend/appointments/models.py:ReservationHold`; `frontend/fetchers/appointments.ts:createHold`; izostanak importa u active pageu | ne može se tvrditi produkcijsko korištenje | da, ili ukloniti tvrdnju | visoko |
| Stručnjak dobiva AI kontekst | Stručnjak kroz appointment request može vidjeti AI sažetak, kategoriju, crisis flag i puni transcript samo ako je podijeljen | `AppointmentRequestSerializer`; `AppointmentRequestCard`; `create_appointment_request` | email o novom zahtjevu ne sadrži AI kontekst | ne nužno | srednje |
| Korisnik kontrolira dijeljenje podataka | Korisnik kontrolira dijeljenje punog transkripta, ali ne i zasebno dijeljenje AI sažetka | `shareFullTranscript` u `frontend/app/carefree/caretaker/[id]/page.tsx` | summary id se šalje ako postoji odabrani summary | da | visoko |
| Prihvaćanje termina sinkronizira Google Calendar | Prihvaćanje termina pokušava stvoriti Google Calendar event i fallbacka ako sync ne uspije | `approve_appointment_request`; `sync_create_google_event_sync`; `build_appointment_payload` | produkcijski credential nije potvrđen | ne za rad, da za produkciju | srednje |
| Odbijanje zahtjeva šalje email | Odbijanje mijenja status; email tok postoji, ali ima grešku i može tiho ne raditi | `AppointmentRequestRejectView` | `settings` nije importan; reason se ne koristi | da | kritično |
| AI razgovori se spremaju | AI sesije i poruke spremaju se u `AssistantSession` i `AssistantMessage` | `backend/assistant/models.py`; `SessionMessageView` | retention ovisi o načinu završetka | da, dokumentirati | visoko |
| Razgovori se brišu nakon završetka | Raw poruke se brišu pri recommendation closure i ručnom brisanju, ali ne općenito za sve closure tipove | `close_session`; `EndSesssionView` | support/crisis raw poruke mogu ostati | da | visoko |
| Snapshot je anonimiziran | Ne treba tvrditi; snapshot je raw kopija poruka bez potvrđene redakcije | `_build_transcript_snapshot` | može sadržavati identifikatore | da | kritično |
| Sustav koristi OpenAI | Assistant i journal mogu pozivati OpenAI modele | `generate_assistant_result`; `classify_journal_safety` | model/provider ovise o env i settingsima; stvarni runtime nije provjeren | ne nužno | srednje |
| Redakcija štiti podatke | Sustav provodi regex-redakciju dijela payloadova, ali to nije potpuna anonimizacija | `redact_sensitive_text`; `redact_message_payload`; `build_messages_for_llm` | imena i system sažeci mogu ostati | da | kritično |
| Dnevnik šalje sadržaj OpenAI-u | Dnevnik može poslati redigirani tekst OpenAI-u ako nema heurističke krize i rate limit dopušta | `JournalEntryViewSet._analysis_fields`; `classify_journal_safety`; `journal_analysis_allowed` | nema opt-out kontrole potvrđene u UI-ju | da | visoko |
| Krizni tok automatski eskalira | Ne treba tvrditi; sustav prikazuje kontakte, ali ne šalje automatsku obavijest | `backend/assistant/prompts.py`; `frontend/app/carefree/messages/page.tsx`; izostanak notification koda | vanjski protokol nije implementiran | da, barem dokumentirati | kritično |
| Crisis flag se pohranjuje | `danger_flag` se sprema na sesiji, a `crisis_flag` na appointment requestu ako se koristi krizni summary | `AssistantSession.danger_flag`; `AppointmentRequest.crisis_flag` | tko ga vidi ovisi o UI toku | ne nužno | srednje |
| JWT autentifikacija je cookie-only | Ne treba tvrditi; backend podržava cookies, ali frontend koristi sessionStorage Bearer tokene | `build_auth_response`; `frontend/lib/auth.ts` | hibridni model nije dokumentiran | da | visoko |
| Produkcijski CORS/CSRF je zaključen | Konfiguracija postoji, ali stvarne produkcijske env vrijednosti nisu potvrđene | `backend/backend/settings.py` | runtime nije provjeren | da, provjeriti | srednje |
| System Google connect je siguran endpoint | Ne treba tvrditi; endpoint je `AllowAny` i oslanja se na feature flag i OAuth uvjete | `SystemGoogleConnectView`; `GoogleOAuthCallbackView` | ako se feature uključi, pokretanje toka nije admin-only | da | visoko |
| Delete account briše sve podatke | Ne treba tvrditi; delete briše user/cascade podatke, ali neki appointment i calendar log zapisi mogu ostati | `deleteUserView`; `AppointmentRequest.student SET_NULL`; `CalendarEventLog.appointment SET_NULL` | vanjski Google event nije potvrđeno obrisan | da | kritično |
| Testovi prolaze | Postojeći lokalni backend/frontend testovi, TypeScript i ESLint prolaze | lokalno pokrenute komande navedene u poglavlju 7 | integracije nisu produkcijski testirane | ne za rad, da za kvalitetu | srednje |
| CI/CD postoji | Nije pronađen CI workflow | izostanak `.github/workflows` | deployment može biti ručan ili vanjski, ali nije dokazivo | po želji | nisko |
| Vanjske integracije su produkcijski aktivne | Sigurno je tvrditi samo da su konfiguracijski podržane | `settings.py`, `emailing.py`, `google_client.py`, `check_external_services.py` | stvarno produkcijsko korištenje nije dokazivo bez runtime provjere | da, dokumentirati | srednje |

## Sažetak prioriteta minimalnih popravaka

### Kritično

- Redigirati ili ukloniti raw transcript snapshot prije dijeljenja stručnjaku.
- Popraviti reject email tok i odlučiti što s reject razlogom.
- Ne tvrditi automatsku kriznu eskalaciju; ili implementirati jasan ljudski protokol.
- Uskladiti delete account s appointment/calendar logovima i vanjskim Google eventima.
- Proširiti redakciju OpenAI payloadova na sve korisničke sadržaje, uključujući system sažetke.

### Visoko

- Dodati korisničku kontrolu za dijeljenje AI sažetka.
- Odlučiti koristi li se `ReservationHold` u aktivnom UI-ju ili se dokumentira kao neaktivno.
- Dokumentirati hibridni JWT/sessionStorage/cookie model ili migrirati na jedan model uz testove.
- Zaštititi `SystemGoogleConnectView` ako se feature može uključiti.
- Jasno dokumentirati lifecycle AI poruka i sažetaka.

### Srednje

- Dodati CI workflow.
- Dodati testove za appointment edge-caseove, redakciju i retenciju.
- Centralizirati krizne kontakte i dodati izvor/datum provjere.
- Pokrenuti safe external services check u stvarnom okruženju bez ispisa tajni.
