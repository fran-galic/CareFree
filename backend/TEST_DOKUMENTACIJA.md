# Backend Test Documentation

Ovaj dokument daje aktualni pregled testnog opsega, a ne staro stanje iz rane faze projekta.

## Trenutno stanje

- backend testovi: 35
- status: svi prolaze

## Aplikacije pod testom

### `accounts`

Pokriveno:

- kreiranje korisnika
- validacija emaila
- rubni uvjeti za godine
- student model
- validacija file uploadova

### `appointments`

Pokriveno:

- edge caseovi servisnih funkcija
- ponašanje oko nepostojećih funkcija / parametara

### `assistant`

Pokriveno:

- start session
- session end guardovi
- prompt pravila
- context building
- support closure flow
- recommendation flow
- fallback category inference
- crisis fallback ponašanje
- summary detail behavior

## Pokretanje

```bash
cd backend
./.venv/bin/python manage.py test
```

## Što ova dokumentacija nije

Ovo nije iscrpan ručni QA plan. Za booking, onboarding, Google Meet i UI tokove i dalje treba odraditi ručni end-to-end prolaz.
