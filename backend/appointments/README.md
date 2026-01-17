# CareFree - Upute za Frontend: Sustav Rezervacije Termina i Kalendar

## Pregled

Ovaj dokument sadrži **kompletne upute za frontend tim** kako implementirati sučelje za rezervaciju termina i integraciju Google Calendar-a. Backend API je potpuno spreman i testiran - ova dokumentacija pokriva sve potrebne endpointe, flow-ove i email notifikacije.

---

## 📋 Sadržaj

1. [API Endpointi](#api-endpointi)
2. [Frontend Flow-ovi](#frontend-flow-ovi)
3. [Google Calendar Integracija](#google-calendar-integracija)
4. [Email Notifikacije](#email-notifikacije)
5. [Vremenske Zone](#vremenske-zone)
6. [Testiranje](#testiranje)

---

## API Endpointi

### 🎓 **Studentski Endpointi**

#### 1. Dohvaćanje dostupnih slotova
```
GET /api/appointments/caretaker/slots/?caretaker_id=<id>&days=3
```
- **Auth**: Bearer token (bilo koji autentificirani korisnik)
- **Query parametri**:
  - `caretaker_id` (required): ID caretaker-a
  - `days` (optional, default=3): Broj dana unaprijed
- **Odgovor**: Array slotova
```json
[
  {
    "start": "2026-01-20T09:00:00+01:00",
    "end": "2026-01-20T10:00:00+01:00",
    "time": "09:00",
    "is_available": true
  },
  ...
]
```
- **is_available**: `false` znači slot je zauzet ili caretaker ga je označio nedostupnim

#### 2. Kreiranje privremenog hold-a
```
POST /api/appointments/holds/
```
- **Auth**: Bearer token (student)
- **Payload**:
```json
{
  "caretaker_id": 12,
  "slot_start": "2026-01-20T09:00:00+01:00",
  "hold_minutes": 10
}
```
- **Odgovor**:
```json
{
  "id": 123,
  "start": "2026-01-20T09:00:00+01:00",
  "expires_at": "2026-01-20T09:10:00+01:00",
  "status": "active"
}
```
- **Frontend task**: Započeti countdown timer (10 min), prikazati upozorenje 1 min prije isteka

#### 3. Oslobađanje hold-a (cancel)
```
POST /api/appointments/holds/<id>/release/
```
- **Auth**: Bearer token (student ili caretaker)
- **Odgovor**: Status 204 No Content

#### 4. Kreiranje zahtjeva za termin
```
POST /api/appointments/request/
```
- **Auth**: Bearer token (student)
- **Payload**:
```json
{
  "caretaker_id": 12,
  "start_time": "2026-01-20",
  "slot_time": "09:00",
  "note": "Trebam pomoć s anksioznošću"
}
```
- **start_time**: Datum (ISO format ili YYYY-MM-DD)
- **slot_time**: Vrijeme (HH:MM format)
- **note**: Poruka za caretaker-a (optional)
- **Odgovor**: AppointmentRequest objekt sa `requested_start`, `requested_end`, `status`

#### 5. Pregled mojih termina
```
GET /api/appointments/
```
- **Auth**: Bearer token (student)
- **Odgovor**: Array potvrđenih termina
```json
[
  {
    "id": 456,
    "caretaker": {...},
    "start": "2026-01-20T09:00:00+01:00",
    "end": "2026-01-20T10:00:00+01:00",
    "status": "confirmed",
    "conference_link": "https://meet.google.com/abc-defg-hij"
  }
]
```

---

### 👨‍⚕️ **Caretaker Endpointi**

#### 6. Pregled dolaznih zahtjeva
```
GET /api/appointments/caretaker/requests/
```
- **Auth**: Bearer token (caretaker)
- **Odgovor**: Array zahtjeva sa statusom `pending`
```json
[
  {
    "id": 789,
    "student": {"user": {"username": "marko", "email": "marko@..."}},
    "requested_start": "2026-01-20T09:00:00+01:00",
    "requested_end": "2026-01-20T10:00:00+01:00",
    "message": "Trebam pomoć s anksioznošću",
    "status": "pending"
  }
]
```

#### 7. Prihvaćanje zahtjeva
```
POST /api/appointments/caretaker/requests/<pk>/approve/
```
- **Auth**: Bearer token (caretaker)
- **Odgovor**: Appointment objekt sa statusom `confirmed_pending_sync`
- **Backend automatski**:
  1. Kreira termin
  2. Šalje email studentu s potvrdom
  3. Kreira Google Calendar event s Meet linkom
  4. Šalje drugi email s Meet linkom (kad sync završi)

#### 8. Odbijanje zahtjeva
```
POST /api/appointments/caretaker/requests/<pk>/reject/
```
- **Auth**: Bearer token (caretaker)
- **Payload** (optional):
```json
{
  "reason": "Razlog odbijanja"
}
```
- **Backend automatski**: Šalje email studentu o odbijanju

#### 9. Pregled mojih termina
```
GET /api/appointments/caretaker/
```
- **Auth**: Bearer token (caretaker)
- **Odgovor**: Array potvrđenih termina (isti format kao studentski endpoint)

#### 10. Toggle dostupnosti pojedinačnih slotova
```
POST /api/appointments/caretaker/availability/toggle/
```
- **Auth**: Bearer token (caretaker)
- **Payload**:
```json
{
  "slots": ["2026-01-20T09:00:00+01:00", "2026-01-20T10:00:00+01:00"],
  "make_available": false
}
```
- **Odgovor**: Status 200 OK
- **Greška**: Ako slot ima potvrđen termin, backend odbija promjenu

#### 11. Bulk spremanje dostupnosti
```
POST /api/appointments/caretaker/availability/save/
```
- **Auth**: Bearer token (caretaker)
- **Payload**:
```json
{
  "slots": [
    {"slot": "2026-01-20T09:00:00+01:00", "is_available": true},
    {"slot": "2026-01-20T10:00:00+01:00", "is_available": false}
  ]
}
```
- **Odgovor**:
```json
{
  "updated": ["2026-01-20T09:00:00+01:00"],
  "failed": [
    {
      "slot": "2026-01-20T10:00:00+01:00",
      "reason": "Slot already taken"
    }
  ]
}
```
- **Frontend task**: Prikazati greške za neuspjele slotove

---

### 📅 **Google Calendar Endpointi (Caretaker)**

#### 12. Provjera statusa Google Calendar veze
```
GET /api/calendar/status/
```
- **Auth**: Bearer token (caretaker)
- **Odgovor**:
```json
{
  "connected": true,
  "expires_at": "2026-02-20T12:00:00Z"
}
```
ili
```json
{
  "connected": false
}
```

#### 13. Započinjanje Google OAuth flow-a
```
GET /api/calendar/connect/
```
- **Auth**: Bearer token (caretaker)
- **Odgovor**:
```json
{
  "auth_url": "https://accounts.google.com/o/oauth2/auth?client_id=...&redirect_uri=..."
}
```
- **Frontend task**: Otvoriti `auth_url` u popup prozoru ili novom tab-u
- **VAŽNO**: Popup mora zadržati autentifikaciju (cookie ili token) da callback endpoint može povezati credentials s korisnikom

#### 14. OAuth callback (automatski)
```
GET /api/calendar/oauth/callback/?code=...&state=...
```
- **Auth**: Zahtijeva authenticated session
- **Opis**: Google automatski preusmjerava ovdje nakon uspješne autorizacije
- **Backend automatski**: Sprema OAuth tokene u bazu
- **Frontend task**: Zatvoriti popup i osvježiti status

#### 15. Odspajanje Google Calendar-a
```
POST /api/calendar/disconnect/
```
- **Auth**: Bearer token (caretaker)
- **Odgovor**: Status 204 No Content
- **Backend automatski**: Poništava tokene i briše iz baze

---

## Frontend Flow-ovi

### 🎓 **Studentski Flow: Rezervacija Termina**

#### Korak po korak:

1. **Odabir caretaker-a**
   - Prikaži listu caretaker-a (već implementirano u frontend-u)
   - Klik na caretaker → otvori stranicu s dostupnim terminima

2. **Prikaz kalendara dostupnih slotova**
   ```typescript
   // Dohvati slotove za 3 dana
   const response = await fetch(
     `/api/appointments/caretaker/slots/?caretaker_id=${caretakerId}&days=3`,
     { headers: { Authorization: `Bearer ${token}` } }
   );
   const slots = await response.json();
   
   // Prikaži u kalendaru
   // - Zeleni slotovi: is_available === true
   // - Sivi slotovi: is_available === false (disabled)
   ```

3. **Klik na dostupan slot → Kreiraj hold**
   ```typescript
   const holdResponse = await fetch('/api/appointments/holds/', {
     method: 'POST',
     headers: { 
       Authorization: `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       caretaker_id: caretakerId,
       slot_start: '2026-01-20T09:00:00+01:00',
       hold_minutes: 10
     })
   });
   const hold = await holdResponse.json();
   
   // Pokreni countdown timer (10 min)
   startCountdown(hold.expires_at);
   ```

4. **Prikaži formu za potvrdu rezervacije**
   - Textarea za poruku caretaker-u
   - Gumb "Pošalji zahtjev"
   - Countdown timer: "Rezervacija ističe za 9:32"
   - Gumb "Odustani" → oslobodi hold

5. **Slanje zahtjeva**
   ```typescript
   const requestResponse = await fetch('/api/appointments/request/', {
     method: 'POST',
     headers: { 
       Authorization: `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       caretaker_id: caretakerId,
       start_time: '2026-01-20',
       slot_time: '09:00',
       note: 'Trebam pomoć s anksioznošću'
     })
   });
   
   if (requestResponse.ok) {
     // Prikaži success poruku
     showSuccess('Zahtjev poslan! Caretaker će ga uskoro pregledati.');
   }
   ```

6. **Provjera statusa zahtjeva**
   - Student dobija email kad caretaker odobri/odbije
   - Također možete dodati stranicu "Moji zahtjevi" (backend već podržava)

7. **Pregled potvrđenih termina**
   ```typescript
   const appointments = await fetch('/api/appointments/', {
     headers: { Authorization: `Bearer ${token}` }
   });
   
   // Prikaži u kalendaru
   // - Svaki termin ima conference_link (Google Meet)
   // - Gumb "Pridruži se" → otvori Meet link
   ```

---

### 👨‍⚕️ **Caretaker Flow 1: Upravljanje Zahtjevima**

#### Korak po korak:

1. **Dashboard sa zahtjevima**
   ```typescript
   const requests = await fetch('/api/appointments/caretaker/requests/', {
     headers: { Authorization: `Bearer ${token}` }
   });
   
   // Prikaži listu zahtjeva (status: pending)
   // Za svaki zahtjev:
   // - Ime studenta
   // - Traženo vrijeme
   // - Poruka studenta
   // - Gumbi: "Prihvati" / "Odbij"
   ```

2. **Prihvaćanje zahtjeva**
   ```typescript
   const approve = await fetch(
     `/api/appointments/caretaker/requests/${requestId}/approve/`,
     {
       method: 'POST',
       headers: { Authorization: `Bearer ${token}` }
     }
   );
   
   if (approve.ok) {
     // Backend automatski:
     // 1. Kreira termin
     // 2. Šalje email studentu i caretaker-u
     // 3. Kreira Google Calendar event + Meet link
     // 4. Šalje drugi email s Meet linkom
     
     showSuccess('Termin potvrđen! Student je obaviješten.');
   }
   ```

3. **Odbijanje zahtjeva**
   ```typescript
   const reject = await fetch(
     `/api/appointments/caretaker/requests/${requestId}/reject/`,
     {
       method: 'POST',
       headers: { 
         Authorization: `Bearer ${token}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         reason: 'Razlog odbijanja (optional)'
       })
     }
   );
   
   // Backend šalje email studentu
   ```

---

### 👨‍⚕️ **Caretaker Flow 2: Google Calendar Integracija**

#### Korak po korak:

1. **Provjera statusa Google Calendar veze**
   ```typescript
   const status = await fetch('/api/calendar/status/', {
     headers: { Authorization: `Bearer ${token}` }
   });
   const { connected } = await status.json();
   
   if (!connected) {
     // Prikaži gumb "Poveži Google Calendar"
   } else {
     // Prikaži "Povezano ✓" i gumb "Odspoji"
   }
   ```

2. **Povezivanje Google Calendar-a (OAuth flow)**
   ```typescript
   // Klik na "Poveži Google Calendar"
   const connectResponse = await fetch('/api/calendar/connect/', {
     headers: { Authorization: `Bearer ${token}` }
   });
   const { auth_url } = await connectResponse.json();
   
   // Otvori OAuth u popup-u
   const popup = window.open(
     auth_url,
     'Google OAuth',
     'width=600,height=700'
   );
   
   // Slušaj kada se popup zatvori
   const checkClosed = setInterval(() => {
     if (popup.closed) {
       clearInterval(checkClosed);
       // Osvježi status
       refreshCalendarStatus();
     }
   }, 1000);
   ```

3. **Odspajanje Google Calendar-a**
   ```typescript
   await fetch('/api/calendar/disconnect/', {
     method: 'POST',
     headers: { Authorization: `Bearer ${token}` }
   });
   
   // Osvježi UI
   ```

**VAŽNO**: Kad je Google Calendar povezan, svi potvrđeni termini **automatski** se dodaju u caretaker-ov osobni Google Calendar s Google Meet linkom!

---

### 👨‍⚕️ **Caretaker Flow 3: Upravljanje Dostupnošću**

#### Korak po korak:

1. **Prikaz kalendara s dostupnošću**
   ```typescript
   // Koristi isti endpoint kao student
   const slots = await fetch(
     `/api/appointments/caretaker/slots/?caretaker_id=${myCaretakerId}&days=7`,
     { headers: { Authorization: `Bearer ${token}` } }
   );
   
   // Prikaži u kalendaru sa mogućnošću edit-a
   // - Zeleni slotovi: is_available === true
   // - Crveni slotovi: is_available === false (označio nedostupnim)
   // - Sivi slotovi: zauzeti terminima (NE MOGU SE MIJENJATI)
   ```

2. **Toggle pojedinačnih slotova** (jednostavniji pristup)
   ```typescript
   // Klik na slot → Toggle dostupnost
   await fetch('/api/appointments/caretaker/availability/toggle/', {
     method: 'POST',
     headers: { 
       Authorization: `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       slots: ['2026-01-20T09:00:00+01:00'],
       make_available: false // ili true
     })
   });
   ```

3. **Bulk spremanje** (napredniji pristup)
   ```typescript
   // Omogući odabir multiple slotova (checkbox)
   // Gumb "Označi dostupnim" / "Označi nedostupnim"
   
   const changes = [
     { slot: '2026-01-20T09:00:00+01:00', is_available: false },
     { slot: '2026-01-20T10:00:00+01:00', is_available: true }
   ];
   
   const response = await fetch(
     '/api/appointments/caretaker/availability/save/',
     {
       method: 'POST',
       headers: { 
         Authorization: `Bearer ${token}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({ slots: changes })
     }
   );
   
   const result = await response.json();
   
   // Prikaži greške
   if (result.failed.length > 0) {
     result.failed.forEach(f => {
       showError(`${f.slot}: ${f.reason}`);
     });
   }
   ```

---

## Google Calendar Integracija

### Kako Radi?

1. **Bez OAuth-a** (default):
   - Backend koristi service account
   - Eventi se kreiraju u **dijeljenom kalendaru**
   - Student i caretaker dobiju Meet link u email-u

2. **S OAuth-om** (preporučeno za caretaker-e):
   - Caretaker poveže svoj osobni Google Calendar
   - Eventi se kreiraju u **njegovom osobnom kalendaru**
   - Automatski se pojavljuju u Google Calendar app-u
   - Google Meet linkovi se automatski generiraju

### Meet Link Generiranje

**Google automatski generira pravi Meet link!**

```python
# Backend šalje:
event = {
  "conferenceData": {
    "createRequest": {"requestId": "unique-id"}
  }
}

# Google vraća:
{
  "hangoutLink": "https://meet.google.com/abc-defg-hij",
  "conferenceData": {
    "entryPoints": [{
      "uri": "https://meet.google.com/abc-defg-hij"
    }]
  }
}
```

- **Meet link je PRAVI sastanak** (ne fake)
- Svatko s linkom može ući
- Sastanak je vezan za Calendar event

---

## Email Notifikacije

Backend **automatski** šalje email-ove u sljedećim situacijama:

### 📧 **Email 1: Student pošalje zahtjev**
```
To: caretaker@example.com
Subject: Novi zahtjev za termin - CareFree

Dobili ste novi zahtjev za termin!

Student: Marko Horvat
Vrijeme: 20.01.2026 u 14:00
Poruka: Trebam pomoć s anksioznošću

Molimo prijavite se u CareFree aplikaciju za potvrdu/odbijanje zahtjeva.
```

### 📧 **Email 2: Caretaker odobri zahtjev**
```
To: student@example.com, caretaker@example.com
Subject: Potvrda termina - CareFree

Vaš zahtjev za razgovor 20.01.2026 u 14:00 je potvrđen!

Sastanku možete pristupiti putem ovog linka: https://meet.google.com/abc-defg-hij
```
*Napomena: Šalje se nakon što Google Calendar sync završi (par sekundi)*

### 📧 **Email 3: Caretaker odbije zahtjev**
```
To: student@example.com, caretaker@example.com
Subject: Zahtjev za termin odbijen - CareFree

Vaš zahtjev za razgovor 20.01.2026 u 14:00 je odbijen.

Molimo da u aplikaciji odaberete neki drugi termin.
```

**Frontend ne mora slati email-ove** - sve je automatizirano!

---

## Vremenske Zone

### Važno za Frontend:

- **Backend pohranjuje sve u UTC**
- **API vraća datume u CET (Europe/Zagreb)** - format: `2026-01-20T09:00:00+01:00`
- **Frontend NE treba konvertirati** - koristite datume kakve backend vraća
- **Prikaz korisniku**: Europe/Zagreb (GMT+1 ili GMT+2 ljeti)

### Primjer:
```typescript
// Backend vraća:
"start": "2026-01-20T09:00:00+01:00"

// Prikaži kao:
"20.01.2026 u 09:00"  // CET

// NE trebate konvertirati u UTC!
```

---

## Testiranje

### Lokalno Testiranje (Dev):

1. **Pokrenite Django server**:
   ```powershell
   cd backend
   python manage.py runserver
   ```

2. **Test email slanje**:
   ```powershell
   python scripts\test_email.py
   ```

3. **Test OAuth flow**:
   ```powershell
   python scripts\test_google_oauth.py
   ```

4. **Kreirajte test korisnike**:
   ```powershell
   python scripts\create_test_users.py
   ```
   - Student: `student@example.local` / `testpass123`
   - Caretaker: `caretaker@example.local` / `testpass123`

### Konfiguracijske Varijable (.env):

Backend već ima sve postavljeno:
```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/calendar/oauth/callback/
EMAIL_HOST_USER=carefree742@gmail.com
EMAIL_HOST_PASSWORD=...
```

**Frontend ne treba ništa konfigurirati** - sve je na backend strani!

---

## Ukratko: Što Frontend Treba Implementirati?

### ✅ Student Strana:

1. **Kalendar dostupnih slotova** (zeleni/sivi)
2. **Hold sistem** s countdown timerom
3. **Forma za slanje zahtjeva** (poruka + potvrda)
4. **Lista mojih termina** s Meet linkom
5. **Gumb "Pridruži se sastanku"** → otvori Meet link

### ✅ Caretaker Strana:

1. **Lista dolaznih zahtjeva** (ime studenta, vrijeme, poruka)
2. **Gumbi "Prihvati" / "Odbij"** za svaki zahtjev
3. **Google Calendar povezivanje**:
   - Gumb "Poveži Google Calendar"
   - OAuth popup
   - Status indicator (povezano/nije povezano)
   - Gumb "Odspoji"
4. **Kalendar dostupnosti**:
   - Prikaz slotova (zeleni/crveni/sivi)
   - Toggle dostupnost (klik na slot)
   - Bulk edit (opciono)
5. **Lista mojih termina** s Meet linkom

---

## 🎯 Prioritet Implementacije

### Faza 1 (Must Have):
- Student: Kalendar slotova + rezervacija
- Caretaker: Pregled i odobravanje zahtjeva

### Faza 2 (Should Have):
- Google Calendar povezivanje (OAuth button)
- Caretaker: Upravljanje dostupnošću

### Faza 3 (Nice to Have):
- Hold sistem s countdown timerom
- Bulk edit dostupnosti
- Napredna kalendar sučelja

---

## 📞 Kontakt

Za pitanja o backend API-ju, obratite se backend timu ili pogledajte:
- `backend/appointments/README.md` (ovaj dokument)
- `backend/calendar_integration/README.md`
- `backend/BACKEND_OAUTH_STATUS.md`

---

**Backend je potpuno spreman - sretno s implementacijom! 🚀**