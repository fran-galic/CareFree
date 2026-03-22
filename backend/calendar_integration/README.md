# Calendar Integration Module

`calendar_integration` povezuje CareFree s Google Calendarom.

Trenutni preferirani produkcijski model:

- jedan shared Google account
- OAuth credential spremljen u `SystemGoogleCredential`
- backend stvara evente u shared kalendaru
- backend pokušava generirati Meet link

## Podržana dva moda

### 1. Shared OAuth credential

Preferirani path.

Uvjeti:

- `GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- spremljen `SystemGoogleCredential`

Endpointi:

- `GET /api/calendar/system/connect/`
- `GET /api/calendar/oauth/callback/`
- `GET /api/calendar/shared-status/`

### 2. Service account fallback

Koristi se samo ako shared OAuth nije konfiguriran.

Uvjeti:

- `GOOGLE_SERVICE_ACCOUNT_FILE` ili `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_CALENDAR_ID`

## Važno ponašanje

Ako je `GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL` postavljen:

- backend očekuje da shared OAuth credential postoji
- ako ne postoji, to tretira kao konfiguracijsku grešku
- ne fallbacka tiho na stari model

To je namjerno kako bi se problem odmah vidio nakon DB reseta ili deploya.

## Modeli

- `Calendar`
- `CalendarEvent`
- `GoogleCredential`
- `SystemGoogleCredential`
- `ReconcileLog`

Napomena:

- `GoogleCredential` i per-user calendar sync postoje kao scaffold i legacy put
- CareFree trenutno ne ovisi o tome kao glavnom business flowu

## Admin / utility endpointi

- `GET /api/calendar/events/`
- `POST /api/calendar/sync-now/`
- `POST /api/calendar/create/`

## Operativni savjet

Nakon svakog lokalnog DB reseta provjeri:

```bash
cd backend
./.venv/bin/python manage.py check_external_services
```

Ako shared credential nedostaje:

1. spoji shared account preko `/api/calendar/system/connect/`
2. provjeri `/api/calendar/shared-status/`
3. tek onda testiraj approve / Meet flow
