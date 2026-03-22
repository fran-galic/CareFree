# Appointments Module

`appointments` pokriva booking domenu:

- student request za termin
- caretaker approve/reject
- confirmed appointment
- availability slotovi
- reservation holdovi
- post-session feedback
- izvoz termina prema calendar integraciji

## Glavni modeli

- `AppointmentRequest`
- `Appointment`
- `AvailabilitySlot`
- `ReservationHold`
- `AppointmentFeedback`
- `CalendarEventLog`

## Glavni endpointi

### Student

- `POST /api/appointments/request/`
- `GET /api/appointments/student/requests/`
- `GET /api/appointments/calendar/my/`
- `GET /api/appointments/student/feedback/pending/`
- `POST /api/appointments/<appointment_id>/feedback/`
- `POST /api/appointments/holds/`
- `POST /api/appointments/holds/<hold_id>/release/`

### Caretaker

- `GET /api/appointments/caretaker/requests/`
- `POST /api/appointments/caretaker/requests/<id>/approve/`
- `POST /api/appointments/caretaker/requests/<id>/reject/`
- `GET /api/appointments/caretaker/`
- `GET /api/appointments/caretaker/availability/my/`
- `POST /api/appointments/caretaker/availability/save/`
- `GET /api/appointments/caretaker/slots/`

## Glavna pravila

- request i appointment slot traju točno 1 sat
- caretaker mora biti odobren da bi bio relevantan za search i booking
- potvrđeni termini ulaze u calendar flow
- feedback je privatan i vezan 1:1 uz appointment
- availability slot se ne može uređivati ako je zauzet aktivnim terminom

## Integracija s Google Calendarom

Approval flow na backendu:

1. caretaker odobri `AppointmentRequest`
2. backend stvori `Appointment`
3. backend pokuša stvoriti Google Calendar event
4. ako uspije, sprema `conference_link`
5. ako sync ne uspije, appointment i dalje postoji sa statusom sync failure

## Frontend potrošači

Najvažniji frontend dijelovi:

- `frontend/app/carefree/caretaker/[id]/page.tsx`
- `frontend/app/carefree/calendar/page.tsx`
- `frontend/app/carefree/dostupnost/page.tsx`
- `frontend/app/carefree/requests/page.tsx`
- `frontend/components/student-dashboard.tsx`
- `frontend/components/appointments/appointment-request-card.tsx`

## Testiranje

Backend testovi se pokreću iz `backend/`:

```bash
./.venv/bin/python manage.py test appointments assistant accounts
```

Za puni booking QA treba ručno provjeriti:

- request creation
- approve
- reject
- calendar rendering
- Meet link state
- feedback flow
