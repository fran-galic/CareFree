# Dokumentacija Testova za Frontend

## Pregled Testova

Ukupan broj testova: **6**

### Kategorije Testova:

1. **Redovni slučajevi**: 2 testa
2. **Rubni uvjeti**: 1 test
3. **Izazivanje iznimki**: 2 testa
4. **Nepostojeće funkcionalnosti**: 1 test

---

## ISPITNI SLUČAJ 1: Uspješno dohvaćanje kategorija pomoći

**Lokacija**: [fetchers/**tests**/users.test.ts](fetchers/__tests__/users.test.ts)  
**Kategorija**: Redovni slučajevi  
**Test funkcija**: `trebao bi uspješno dohvatiti kategorije pomoći`

### Opis

Testira funkciju `getHelpCategories()` koja dohvaća popis svih dostupnih kategorija pomoći iz API-ja.

### Ulaz

```typescript
getHelpCategories()
// Mock vraća: [
//   { id: 1, name: "Anksioznost", subcategories: [] },
//   { id: 2, name: "Kontrola emocija", subcategories: [] },
// ]
```

### Očekivani rezultat

Niz objekata sa kategorijama pomoći.

### Stvarni rezultat

✅ Test prolazi - funkcija uspješno dohvaća i vraća popis kategorija pomoći.

---

## ISPITNI SLUČAJ 2: Uspješan API poziv

**Lokacija**: [fetchers/**tests**/fetcher.test.ts](fetchers/__tests__/fetcher.test.ts)  
**Kategorija**: Redovni slučajevi  
**Test funkcija**: `trebao bi uspješno dohvatiti podatke iz API-ja`

### Opis

Testira `fetcher()` funkciju za uspješan GET zahtjev prema API-ju.

### Ulaz

```typescript
fetcher("http://localhost:8000/api/users/1")
// Mock vraća: { id: 1, name: 'Test User' }
```

### Očekivani rezultat

Objekt sa podacima korisnika: `{ id: 1, name: 'Test User' }`

### Stvarni rezultat

✅ Test prolazi - funkcija vraća mock podatke iz API-ja.

---

## ISPITNI SLUČAJ 3: Pretraživanje sa praznim query parametrima

**Lokacija**: [fetchers/**tests**/users.test.ts](fetchers/__tests__/users.test.ts)  
**Kategorija**: Rubni uvjeti  
**Test funkcija**: `trebao bi rukovati pretraživanjem sa praznim upitom`

### Opis

Testira kako funkcija `searchCaretakers()` radi kada korisnik pošalje prazan upit za pretraživanje.

### Ulaz

```typescript
searchCaretakers("", [], 1)
// Mock vraća: { results: [], count: 0, next: null, previous: null }
```

### Očekivani rezultat

Prazan niz rezultata sa count=0.

### Stvarni rezultat

✅ Test prolazi - funkcija pravilno radi praznim upitom i vraća prazne rezultate.

---

## ISPITNI SLUČAJ 4: Greška pri neuspješnom API pozivu

**Lokacija**: [fetchers/**tests**/fetcher.test.ts](fetchers/__tests__/fetcher.test.ts)  
**Kategorija**: Izazivanje iznimki  
**Test funkcija**: `trebao bi baciti grešku kada API vrati status koji nije ok`

### Opis

Testira kako `fetcher()` radi sa HTTP greškama (npr. 404 Not Found).

### Ulaz

```typescript
fetcher("http://localhost:8000/api/users/999")
// Mock vraća: status 404
```

### Očekivani rezultat

Bacanje iznimke sa porukom: `'Fetch failed: 404 Not Found'`

### Stvarni rezultat

✅ Test prolazi - funkcija baca očekivanu iznimku sa odgovarajućom porukom.

---

## ISPITNI SLUČAJ 5: Mrežna greška

**Lokacija**: [fetchers/**tests**/fetcher.test.ts](fetchers/__tests__/fetcher.test.ts)  
**Kategorija**: Izazivanje iznimki  
**Test funkcija**: `trebao bi pravilno rukovati mrežnim greškama`

### Opis

Testira kako `fetcher()` radi sa mrežnim greškama (npr. offline mode).

### Ulaz

```typescript
fetcher("http://localhost:8000/api/test")
// Mock baca: Error('Network error')
```

### Očekivani rezultat

Bacanje iznimke sa porukom: `'Fetcher error: Network error'`

### Stvarni rezultat

✅ Test prolazi - funkcija hvata mrežnu grešku i baca novu sa odgovarajućom porukom.

---

## ISPITNI SLUČAJ 6: Nepostojeća funkcija

**Lokacija**: [fetchers/**tests**/users.test.ts](fetchers/__tests__/users.test.ts)  
**Kategorija**: Nepostojeće funkcionalnosti  
**Test funkcija**: `trebao bi baciti grešku pri pozivu nepostojeće funkcije`

### Opis

Testira pozivanje funkcije koja ne postoji u `users` modulu.

### Ulaz

```typescript
usersModule.getNonExistentCaretakerData()
```

### Očekivani rezultat

Bacanje TypeError iznimke jer funkcija ne postoji.

### Stvarni rezultat

✅ Test prolazi - poziv nepostojeće funkcije baca TypeError.

---

## Rezime Testova po Kategorijama

| Kategorija                      | Broj testova | Testovi                                                           |
| ------------------------------- | ------------ | ----------------------------------------------------------------- |
| **Redovni slučajevi**           | 2            | 1. Uspješno dohvaćanje kategorija pomoći<br>2. Uspješan API poziv |
| **Rubni uvjeti**                | 1            | 3. Pretraživanje sa praznim query parametrima                     |
| **Izazivanje iznimki**          | 2            | 4. Greška pri neuspješnom API pozivu<br>5. Mrežna greška          |
| **Nepostojeće funkcionalnosti** | 1            | 6. Nepostojeća funkcija                                           |
| **UKUPNO**                      | **6**        |                                                                   |

---

## Pokretanje Testova

### Instalacija potrebnih paketa:

```bash
cd frontend
pnpm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest ts-node
```

### Pokretanje svih testova:

```bash
pnpm test
```

### Pokretanje testova u watch modu:

```bash
pnpm test:watch
```

### Pokretanje testova za određeni fajl:

```bash
pnpm test fetcher.test.ts
pnpm test users.test.ts
```

---

## Struktura Test Fajlova

```
frontend/
├── fetchers/
│   ├── __tests__/
│   │   ├── fetcher.test.ts (3 testa)
│   │   └── users.test.ts (3 testa)
│   ├── fetcher.ts
│   └── users.ts
├── jest.config.js
└── jest.setup.js
```

---

## Tehnički Detalji

- **Test Framework**: Jest
- **Biblioteke za testiranje**: @testing-library/react, @testing-library/jest-dom
- **Test okruženje**: jsdom (simulira browser okruženje)
- **Jezik**: TypeScript
- **Menadžer paketa**: pnpm
- **Ukupno test fajlova**: 2
- **Ukupno testova**: 6

---

## Napomene

1. Testovi koriste mock funkcionalnost Jesta za simuliranje API poziva
2. Svi testovi su nezavisni i ne dijele stanje
3. `beforeEach` blokovi osiguravaju čišćenje mock-ova između testova
4. Testovi pokrivaju sve četiri tražene kategorije komponenti
5. Fokus testova je na validaciji input parametara i dohvaćanju podataka iz API-ja
