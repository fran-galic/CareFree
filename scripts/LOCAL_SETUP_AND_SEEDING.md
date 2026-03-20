# Lokalni reset i demo podaci

Ovaj dokument pokriva skripte u folderu `scripts/` za lokalni reset baze, seedanje kategorija i generiranje demo psihologa.

## Preduvjeti

- Backend virtualno okruzenje mora postojati u `backend/.venv`
- Backend dependencyji moraju biti instalirani
- Skripte se pokrecu iz roota repozitorija ili eksplicitno preko `bash scripts/...`

## 1. Potpuni lokalni reset aplikacije

Pokretanje:

```bash
bash scripts/reset_local_app.sh
```

Sto radi:

- brise lokalnu SQLite bazu `backend/db.sqlite3`
- brise lokalni `backend/media`
- pokrece sve migracije ispocetka
- seeda help kategorije
- kreira default admin korisnika

Default admin podaci:

- Email: `admin@carefree.com`
- Password: `admin123`

Po potrebi se mogu promijeniti preko env varijabli:

```bash
SUPERUSER_EMAIL=admin@carefree.com \
SUPERUSER_PASSWORD=admin123 \
SUPERUSER_FIRST_NAME=Admin \
SUPERUSER_LAST_NAME=User \
bash scripts/reset_local_app.sh
```

## 2. Seed demo psihologa

Pokretanje:

```bash
bash scripts/seed_demo_caretakers.sh
```

Sto radi:

- seeda demo psihologe na temelju slika iz `demo_profiles/`
- koristi prefikse slika `w_` i `m_` da uskladi spol i ime profila
- za svakog psihologa postavlja odobren profil
- dodjeljuje realisticne opise i kategorije
- puni dostupnost za aktualni i sljedeci tjedan
- attacha demo CV, diplome i certifikate

Napomena za slike:

- zenske slike trebaju imati format `w_1.jpg`, `w_2.jpg`, ...
- muske slike trebaju imati format `m_1.jpg`, `m_2.jpg`, ...
- ako neka stara demo slika vise ne postoji, seed skripta ce obrisati odgovarajuci visak demo korisnika

Opcionalni argumenti:

```bash
bash scripts/seed_demo_caretakers.sh --count 10
bash scripts/seed_demo_caretakers.sh --password 'DemoPsiholog123!'
```

Default lozinka za sve demo psihologe:

- Password: `DemoPsiholog123!`

Email adrese demo psihologa generiraju se u formatu:

- `ime.prezime.XX@demo.carefree.local`

Primjer:

- `ana.horvat.01@demo.carefree.local`

## 3. Preporuceni redoslijed nakon clean reseta

```bash
bash scripts/reset_local_app.sh
bash scripts/seed_demo_caretakers.sh
```

## 4. Sto koja skripta ne radi

- `reset_local_app.sh` ne seed-a demo psihologe automatski
- `seed_demo_caretakers.sh` ne radi migracije i ne resetira bazu

Zato se za potpuno svjezu lokalnu bazu koriste obje skripte, tim redoslijedom.
