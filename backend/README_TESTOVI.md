# Testiranje komponenti - Backend

## Opis

Ovaj direktorij sadrži automatske testove za backend CareFree aplikacije. Testovi pokrivaju:

- ✅ Redovne slučajeve korištenja
- ✅ Rubne uvjete (granice validnosti)
- ✅ Izazivanje iznimki
- ✅ Nepostojeće funkcionalnosti

**Ukupno: 11 testova**

## Lokacija testova

```
backend/
├── accounts/
│   └── tests.py                              # 9 testova
├── appointments/
│   └── tests.py                              # 2 testa
└── TEST_DOKUMENTACIJA.md                     # Detaljna dokumentacija
```

## Pokretanje testova

### 1. Pokreni sve testove

```bash
python manage.py test
```

### 2. Pokreni testove s detaljnim outputom

```bash
python manage.py test --verbosity=2
```

### 3. Pokreni specifičan test razred

```bash
python manage.py test accounts.tests.UserModelTest
```

### 4. Pokreni jedan test

```bash
python manage.py test accounts.tests.UserModelTest.test_create_user_regular_case
```

## Rezultati testova

```
Ran 11 tests in 2.698s

OK
```

Svi testovi prolaze

## Pokrivene kategorije

| Kategorija                  | Broj testova | Status         |
| --------------------------- | ------------ | -------------- |
| Redovni slučajevi           | 3            | ✅ Svi prolaze |
| Rubni uvjeti                | 2            | ✅ Svi prolaze |
| Izazivanje iznimki          | 4            | ✅ Svi prolaze |
| Nepostojeće funkcionalnosti | 4            | ✅ Svi prolaze |

## Testirane komponente

### 1. **User Management** (accounts/tests.py)

- Kreiranje korisnika
- Validacija email adrese
- Validacija starosti (0-100)
- Kreiranje studenata
- File validatori (PDF, JPG, JPEG, max 10MB)
- Nepostojeće metode i atributi

### 2. **Appointments Services** (appointments/tests.py)

- Nepostojeće servisne funkcije
- Nepostojeći parametri funkcija

## Detaljna dokumentacija

Za potpunu dokumentaciju svakog testa (ulazni podaci, očekivani rezultati, postupak izvođenja), pogledaj:

📄 **[TEST_DOKUMENTACIJA.md](TEST_DOKUMENTACIJA.md)**

## Napomene

1. Testovi automatski kreiraju privremenu test bazu podataka
2. Svi podaci se brišu nakon završetka testova
3. Testovi su izolirani i ne utječu jedni na druge
4. Koristi se mocking za eksterne pozive (email, Celery tasks)

## Tehnički detalji

- **Framework:** Django TestCase
- **Python:** 3.x
- **Baza podataka:** SQLite (in-memory test DB)
- **CI/CD ready:** ✅
