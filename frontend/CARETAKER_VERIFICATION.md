# Caretaker Verification - Frontend Implementacija

## 📋 Što je implementirano

Kompletna stranica za verifikaciju caretaker profila sa svim potrebnim funkcionalnostima:

### ✅ Implementirane funkcije

1. **Upload dokumenta**
   - CV upload (PDF/JPG/JPEG, max 10MB)
   - Diploma upload - multiple (PDF/JPG/JPEG, max 10MB)
   - Profilna slika upload (JPG/JPEG, max 10MB)

2. **Profil podaci**
   - Telefon (obavezno)
   - O meni (obavezno)
   - Godina diplomiranja
   - Kategorije pomoći (multi-select, obavezno)

3. **Status verifikacije**
   - `is_profile_complete` - pokazuje da li je profil potpun
   - `approval_status` - PENDING/APPROVED/DENIED
   - `is_approved` - boolean za odobrenje

4. **UI Indikatori**
   - ✅ Badge za status (Odobren, Čeka odobrenje, Odbijen, Nepotpun profil)
   - ⚠️ Alert upozorenje ako profil nije potpun
   - ✓ CheckCircle ikone za uploadane dokumente
   - Real-time feedback pri uploadu

---

## 🗂️ Datoteke

### Nove/Izmijenjene datoteke:

1. **`fetchers/users.ts`**
   - `getCaretakerProfile()` - dohvat profila
   - `uploadCV(file)` - upload CV-a
   - `uploadDiploma(file)` - upload diplome
   - `uploadCaretakerImage(file)` - upload slike
   - `updateCaretakerProfile(data)` - ažuriranje profila
   - `getHelpCategories()` - dohvat kategorija pomoći

2. **`app/carefree/profile/caretaker/page.tsx`**
   - Potpuno prepisana stranica sa upload funkcionalnostima
   - Multi-step verifikacija
   - Status prikaz

3. **`components/ui/alert.tsx`** (NOVO)
   - Alert komponenta za upozorenja

---

## 🔄 Backend API Endpointi

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/auth/caretaker/register/` | GET | Dohvat caretaker profila |
| `/auth/caretaker/register/` | POST | Ažuriranje profila (sve obavezno) |
| `/auth/caretaker/cv/` | POST | Upload CV-a |
| `/auth/caretaker/diploma/` | POST | Upload diplome |
| `/auth/caretaker/image/` | POST | Upload profilne slike |
| `/users/caretakers/help-categories` | GET | Dohvat kategorija pomoći |

---

## 🎯 Kako koristiti

### Korak 1: Prijava kao caretaker
Registrirajte se ili prijavite kao korisnik s `role="caretaker"`

### Korak 2: Popunite profil
Idite na `/carefree/profile/caretaker`

### Korak 3: Upload dokumenta
1. Kliknite na "Choose File" za svaki dokument
2. Odaberite datoteku
3. Kliknite Upload button (ikona Upload)
4. Pričekajte potvrdu

### Korak 4: Popunite podatke
- Unesite telefon
- Napišite biografiju (O meni)
- Odaberite godinu diplomiranja
- **OBAVEZNO:** Odaberite barem jednu kategoriju pomoći

### Korak 5: Spremi profil
Kliknite "Spremi profil" button

---

## ⚠️ Validacija

Backend će odbiti spremanje ako:
- ❌ Nema uploadanog CV-a
- ❌ Nema uploadane barem jedne diplome
- ❌ Nema uploadane profilne slike
- ❌ Telefon nije unesen
- ❌ "O meni" nije uneseno
- ❌ Nema odabrane kategorije pomoći

---

## 🎨 Status Badgeovi

| Status | Badge | Značenje |
|--------|-------|----------|
| Nepotpun | 🔴 Nepotpun profil | Dokumenti ili podaci nedostaju |
| Pending | ⏱️ Čeka odobrenje | Profil potpun, čeka admin odobrenje |
| Approved | ✅ Odobren | Administrator je odobrio profil |
| Denied | ❌ Odbijen | Administrator je odbio profil |

---

## 🔐 Permisije

- `IsCaretaker` - samo korisnici s `role='caretaker'` mogu pristupiti
- `IsApprovedCaretaker` - samo odobreni caretakeri mogu koristiti određene funkcije (npr. chat)

---

## 📝 Napomene

1. **Dokumenti se mogu uploadati samo jedan po jedan**
2. **CV se zamjenjuje** - ako uploadate novi, stari se briše
3. **Diplome se akumuliraju** - možete uploadati više njih
4. **Slika se zamjenjuje** - zadnja uploadana ostaje
5. **Kategorije** - hijerarhijski sustav (parent-child)
   - Možete odabrati glavnu kategoriju i/ili subkategorije

---

## 🐛 Debugging

Ako nešto ne radi:

1. Provjerite konzolu u browseru (F12)
2. Provjerite network tab za API odgovore
3. Provjerite da li su svi environment variables postavljeni (`NEXT_PUBLIC_BACKEND_URL`)
4. Provjerite da li backend radi i da li su endpointi dostupni

---

## 🚀 Idući koraci

Nakon što caretaker popuni profil:
1. Administrator dobiva obavijest (TODO: implementirati)
2. Administrator pregleda dokumente u Django Admin panelu
3. Administrator postavlja `is_approved = True` ili `approval_status = 'DENIED'`
4. Caretaker vidi ažuriran status na svom profilu
