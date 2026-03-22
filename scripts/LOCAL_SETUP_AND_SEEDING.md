# Lokalni reset i demo seed

Ovaj dokument opisuje skripte u `scripts/` direktoriju.

## Preduvjeti

- backend virtualno okruženje postoji u `backend/.venv`
- dependencyji su instalirani
- skripte se pokreću iz roota repoa

## 1. Potpuni lokalni reset

```bash
bash scripts/reset_local_app.sh
```

Skripta:

- briše `backend/db.sqlite3`
- briše lokalni `backend/media`
- pokreće migracije
- seeda help kategorije
- kreira default admina

Default admin:

- email: `admin@carefree.com`
- password: `<redacted-admin-password>`

Možeš overrideati:

```bash
SUPERUSER_EMAIL=admin@carefree.com \
SUPERUSER_PASSWORD=<redacted-admin-password> \
SUPERUSER_FIRST_NAME=Admin \
SUPERUSER_LAST_NAME=User \
bash scripts/reset_local_app.sh
```

## 2. Seed demo psihologa i demo studenta

```bash
bash scripts/seed_demo_caretakers.sh
```

Skripta:

- koristi slike iz `demo_profiles/`
- očekuje prefikse `m_` i `w_`
- generira approved caretaker profile
- dodjeljuje kategorije
- attacha placeholder dokumente
- puni availability za dvotjedni booking prozor
- kreira demo studenta
- kreira završene demo appointmente za feedback flow

Opcionalni argumenti:

```bash
bash scripts/seed_demo_caretakers.sh --count 10
bash scripts/seed_demo_caretakers.sh --password '<redacted-demo-psychologist-password>'
```

Default lozinke:

- demo caretakeri: `<redacted-demo-psychologist-password>`
- demo student: `<redacted-demo-student-password>`

## 3. Preporučeni redoslijed

```bash
bash scripts/reset_local_app.sh
bash scripts/seed_demo_caretakers.sh
```

## 4. Što skripte ne rade

- ne konfiguriraju vanjske servise
- ne spajaju shared Google OAuth credential
- ne pokreću frontend
