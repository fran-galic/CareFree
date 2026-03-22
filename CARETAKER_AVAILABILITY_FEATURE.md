# Caretaker Availability Feature

Ovaj dokument opisuje trenutno implementirano stanje caretaker availability funkcionalnosti.

## Što funkcionalnost radi

Caretaker ručno označava dostupne jednosatne slotove unutar booking prozora:

- aktualni tjedan
- sljedeći tjedan
- ukupno 14 dana
- radno vrijeme `08:00-18:00`

Student kod rezervacije vidi samo slobodne slotove koji:

- pripadaju odabranom caretakeru
- označeni su kao dostupni
- nisu zauzeti postojećim terminom
- nisu blokirani aktivnim holdom ili validacijom servisa

## Backend endpointi

### Caretaker: dohvat vlastite dostupnosti

```http
GET /api/appointments/caretaker/availability/my/?days=14
```

Vraća slotove s poljima:

- `start`
- `end`
- `is_available`
- `has_appointment`

### Caretaker: bulk spremanje

```http
POST /api/appointments/caretaker/availability/save/
```

Payload:

```json
{
  "slots": [
    {
      "slot": "2026-03-24T09:00:00.000Z",
      "is_available": true
    }
  ]
}
```

Backend:

- update/create-a `AvailabilitySlot`
- odbija zauzete slotove
- vraća `updated` i `failed`
- best-effort trigerira sync task

### Student: dohvat bookable slotova

```http
GET /api/appointments/caretaker/slots/?caretaker_id=<id>&days=14
```

## Frontend stanje

Glavna caretaker stranica:

- `/carefree/dostupnost`

Karakteristike UI-a:

- grid po tjednima
- 7 dana odjednom
- strelice za prebacivanje između ovog i sljedećeg tjedna
- zaključani prošli dani
- zaključani slotovi s postojećim terminom
- batch save

Boje:

- teal: dostupan slot
- svijetlo sivo: nedostupan slot
- tamni teal: slot s terminom
- označeni border: nespremljena promjena

## Poslovna pravila

- slot traje točno 1 sat
- caretaker ne može mijenjati slot s potvrđenim terminom
- student ne vidi slotove izvan booking prozora
- student ne može bukirati termin u prošlosti

## Povezani moduli

- backend model: `AvailabilitySlot`
- backend servis: `appointments/services.py`
- backend view: `appointments/views.py`
- frontend page: `frontend/app/carefree/dostupnost/page.tsx`
- frontend shared constants: `frontend/lib/calendar.ts`

## Što još nije cilj ove funkcionalnosti

Ovo nije:

- recurring availability engine
- multi-duration appointment system
- calendar invite editor za caretakera

Fokus je isključivo na jednostavnom i čitljivom postavljanju dostupnih jednosatnih slotova za booking flow.
