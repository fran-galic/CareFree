# Backend Tests

Backend testovi trenutno pokrivaju više od početnog minimalnog skupa i aktivno uključuju:

- `accounts`
- `appointments`
- `assistant`

Trenutno stanje:

- 35 testova
- svi prolaze

## Pokretanje

Iz `backend/` direktorija:

```bash
./.venv/bin/python manage.py test
```

Detaljniji output:

```bash
./.venv/bin/python manage.py test --verbosity=2
```

Samo jedna aplikacija:

```bash
./.venv/bin/python manage.py test assistant
./.venv/bin/python manage.py test appointments
./.venv/bin/python manage.py test accounts
```

## Što testovi realno pokrivaju

- user i student model ponašanje
- validatore uploadova
- appointment service edge caseove
- assistant session flow
- recommendation flow
- crisis fallback ponašanje
- summary persistence

## Bitna napomena

Starija dokumentacija koja spominje 11 backend testova više nije aktualna.
