# Journal Module

`journal` omogućuje studentu privatne dnevničke zapise.

## Što radi

- CRUD nad `JournalEntry`
- sadržaj zapisa se sprema enkriptirano
- serializer pri čitanju vraća dekriptirani sadržaj

## API

- `GET /api/journal/`
- `POST /api/journal/`
- `GET /api/journal/<id>/`
- `PATCH /api/journal/<id>/`
- `DELETE /api/journal/<id>/`

Autentikacija:

- JWT header ili cookie auth, ovisno o klijentu

## Enkripcija

Koristi se `cryptography.Fernet` i `ENCRYPTION_KEY`.

### Produkcija

U produkciji moraš postaviti stabilan `ENCRYPTION_KEY`.

Ako ga izgubiš:

- postojeći zapisi više se ne mogu dekriptirati

### Lokalni razvoj

U `DEBUG=True` modu backend može generirati privremeni ključ ako `ENCRYPTION_KEY` nije postavljen.

To je isključivo razvojna pogodnost.

## Kako generirati ključ

```bash
python - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY
```

## Pravila

- nikad ne committaj `ENCRYPTION_KEY`
- koristi isti ključ na svim produkcijskim instancama
- planiraj rotaciju samo uz jasnu migracijsku proceduru

## Export

Postoji management command:

```bash
python manage.py export_journal
```

Dekripcija pri izvozu traži pristup `ENCRYPTION_KEY`.
