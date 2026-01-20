# Ispitivanje komponenti - Test dokumentacija

## Pregled

Ovaj dokument sadrži detaljan opis svih ispitnih slučajeva razvijenih za backend CareFree aplikacije. Testovi pokrivaju osnovne funkcionalnosti implementiranih razreda, rubne uvjete, izazivanje iznimki i nepostojeće funkcionalnosti.

## Struktura testova

Testovi su organizirani u dvije glavne datoteke:

1. **`backend/accounts/tests.py`** - 9 testova za korisnički sustav
2. **`backend/appointments/tests.py`** - 2 testa za servisne funkcije

**Ukupno: 11 testova**

## Postupak izvođenja testova

### 1. Priprema okruženja

```bash
cd backend
python manage.py test
```

### 2. Pokretanje specifičnih testova

```bash
# Samo testovi za accounts aplikaciju
python manage.py test accounts.tests

# Samo testovi za appointments aplikaciju
python manage.py test appointments.tests

# Pokretanje pojedinačnog test razreda
python manage.py test accounts.tests.UserModelTest

# Pokretanje pojedinačnog testa
python manage.py test accounts.tests.UserModelTest.test_create_user_regular_case
```

### 3. Pokretanje s detaljnim outputom

```bash
python manage.py test --verbosity=2
```

---

## Detaljni opis ispitnih slučajeva

### Test Case 1: UserModelTest - Testiranje User modela

**Lokacija:** `backend/accounts/tests.py`

#### ISPITNI SLUČAJ 1: test_create_user_regular_case

**Kategorija:** Redovan slučaj

**Funkcionalnost:** Kreiranje korisnika s valjanim podacima

**Ulazni podaci:**

- email: `test@example.com`
- password: `testpass123`
- first_name: `Ana`
- last_name: `Horvat`
- age: `25`

**Očekivani rezultat:** Korisnik se uspješno kreira i sprema u bazu podataka

**Dobiveni rezultat:** ✅ PROLAZ - Korisnik se kreira s ispravnim atributima

---

#### ISPITNI SLUČAJ 2: test_create_user_boundary_age_exceeds_max

**Kategorija:** Rubni uvjet / Izazivanje iznimke

**Funkcionalnost:** Pokušaj kreiranja korisnika sa starošću iznad maksimuma

**Ulazni podaci:**

- email: `tooold@example.com`
- age: `101` (iznad MAX_USER_AGE od 100)

**Očekivani rezultat:** `ValidationError` iznimka

**Dobiveni rezultat:** ✅ PROLAZ - ValidationError se ispravno baca

---

#### ISPITNI SLUČAJ 3: test_create_user_without_email_exception

**Kategorija:** Izazivanje iznimke

**Funkcionalnost:** Pokušaj kreiranja korisnika bez email adrese

**Ulazni podaci:**

- email: `''` (prazan string)
- password: `testpass123`

**Očekivani rezultat:** `ValueError` iznimka

**Dobiveni rezultat:** ✅ PROLAZ - ValueError se ispravno baca

---

### Test Case 2: StudentModelTest - Testiranje Student modela

**Lokacija:** `backend/accounts/tests.py`

#### ISPITNI SLUČAJ 4: test_create_student_regular_case

**Kategorija:** Redovan slučaj

**Funkcionalnost:** Kreiranje studenta s valjanim podacima

**Ulazni podaci:**

- user: valjan User objekt
- studying_at: `Fakultet elektrotehnike i računarstva`
- year_of_study: `3`

**Očekivani rezultat:** Student se uspješno kreira s default is_anonymous=True

**Dobiveni rezultat:** ✅ PROLAZ - Student objekt se kreira ispravno

---

### Test Case 3: FileValidatorTest - Testiranje validatora za datoteke

**Lokacija:** `backend/accounts/tests.py`

#### ISPITNI SLUČAJ 5: test_validate_file_type_pdf_valid

**Kategorija:** Redovan slučaj

**Funkcionalnost:** Validacija PDF datoteke

**Ulazni podaci:**

- filename: `test.pdf`
- size: `~13 bytes` (unutar limita)

**Očekivani rezultat:** Validacija prolazi bez iznimke

**Dobiveni rezultat:** ✅ PROLAZ - PDF datoteka se prihvaća

---

#### ISPITNI SLUČAJ 6: test_validate_file_type_invalid_extension

**Kategorija:** Izazivanje iznimke

**Funkcionalnost:** Pokušaj uploada datoteke s nepodržanim formatom

**Ulazni podaci:**

- filename: `document.docx`

**Očekivani rezultat:** `ValidationError` s porukom "Unsupported file extension"

**Dobiveni rezultat:** ✅ PROLAZ - ValidationError s ispravnom porukom

---

#### ISPITNI SLUČAJ 7: test_validate_file_size_exceeds_limit

**Kategorija:** Rubni uvjet / Izazivanje iznimke

**Funkcionalnost:** Pokušaj uploada datoteke veće od maksimalne veličine

**Ulazni podaci:**

- filename: `large.pdf`
- size: `11 MB` (iznad limita od 10 MB)

**Očekivani rezultat:** `ValidationError` s porukom "File too large"

**Dobiveni rezultat:** ✅ PROLAZ - ValidationError s ispravnom porukom

---

### Test Case 4: NonExistentFunctionalityTest - Testiranje nepostojećih funkcionalnosti

**Lokacija:** `backend/accounts/tests.py`

#### ISPITNI SLUČAJ 8: test_user_nonexistent_method

**Kategorija:** Nepostojeća funkcionalnost

**Funkcionalnost:** Poziv neimplementirane metode na User objektu

**Ulazni podaci:**

- user objekt
- poziv metode: `user.get_premium_status()`

**Očekivani rezultat:** `AttributeError` iznimka

**Dobiveni rezultat:** ✅ PROLAZ - AttributeError se baca

---

#### ISPITNI SLUČAJ 9: test_student_nonexistent_property

**Kategorija:** Nepostojeća funkcionalnost

**Funkcionalnost:** Pristup nepostojećem atributu Student objekta

**Ulazni podaci:**

- student objekt
- pristup atributu: `student.gpa`

**Očekivani rezultat:** `AttributeError` iznimka

**Dobiveni rezultat:** ✅ PROLAZ - AttributeError se baca

---

### Test Case 5: ServiceNonExistentFunctionalityTest - Nepostojeće funkcionalnosti servisa

**Lokacija:** `backend/appointments/tests.py`

#### ISPITNI SLUČAJ 10: test_nonexistent_service_function

**Kategorija:** Nepostojeća funkcionalnost

**Funkcionalnost:** Poziv neimplementirane servisne funkcije

**Ulazni podaci:**

- poziv funkcije: `services.cancel_all_appointments_for_caretaker()`

**Očekivani rezultat:** `AttributeError` iznimka

**Dobiveni rezultat:** ✅ PROLAZ - AttributeError se baca

---

#### ISPITNI SLUČAJ 11: test_nonexistent_service_parameter

**Kategorija:** Nepostojeća funkcionalnost

**Funkcionalnost:** Poziv funkcije s nepostojećim parametrom

**Ulazni podaci:**

- funkcija: `create_appointment_request`
- nepostojeći parametar: `priority="high"`

**Očekivani rezultat:** `TypeError` iznimka

**Dobiveni rezultat:** ✅ PROLAZ - TypeError se baca

---

## Sažetak rezultata

| Kategorija                  | Broj testova | Status         |
| --------------------------- | ------------ | -------------- |
| Redovni slučajevi           | 3            | ✅ Svi prolaze |
| Rubni uvjeti                | 2            | ✅ Svi prolaze |
| Izazivanje iznimki          | 4            | ✅ Svi prolaze |
| Nepostojeće funkcionalnosti | 4            | ✅ Svi prolaze |
| **UKUPNO**                  | **11**       | **✅ 11/11**   |

## Pokrivene funkcionalnosti

### 1. User Management (accounts)

- ✅ Kreiranje korisnika
- ✅ Validacija email adrese
- ✅ Validacija starosti (min: 0, max: 100)
- ✅ Kreiranje studenata
- ✅ File validacija (PDF, DOCX - nepodržan, max 10MB)

### 2. Nepostojeće funkcionalnosti

- ✅ Pozivi nepostojećih metoda na objektima
- ✅ Pristup nepostojećim atributima
- ✅ Pozivi nepostojećih servisnih funkcija
- ✅ Parametri koji ne postoje

## Tehnički detalji

### Korištene tehnologije

- **Testing Framework:** Django TestCase
- **Python Version:** 3.x
- **Django Version:** 4.x+

### Testne baze podataka

Testovi koriste privremenu in-memory bazu podataka koja se automatski kreira i briše nakon izvršenja testova.

## Zaključak

Svih 11 ispitnih slučajeva uspješno prolaze i pokrivaju:

- ✅ **Redovne slučajeve** - uobičajeno ponašanje sustava (3 testa)
- ✅ **Rubne uvjete** - granice valjanosti ulaznih podataka (2 testa)
- ✅ **Izazivanje iznimki** - ispravno rukovanje greškama (4 testa)
- ✅ **Nepostojeće funkcionalnosti** - provjera reakcije na neimplementirane metode (4 testa)
