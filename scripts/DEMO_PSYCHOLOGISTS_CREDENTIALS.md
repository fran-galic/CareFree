# Demo caretaker credentials

Ovaj dokument opisuje kako funkcioniraju demo caretaker accounti.

## Bitno

Emailovi ovise o trenutno dostupnim slikama u `demo_profiles/` i redoslijedu seeda.

Zato ovu listu tretiraj kao snapshot, ne kao trajni ugovor.

## Generiranje

Pokreni:

```bash
bash scripts/seed_demo_caretakers.sh
```

Skripta generira emailove oblika:

```text
ime.prezime.XX@demo.carefree.local
```

## Default lozinke

- demo caretakeri: `DemoPsiholog123!`
- demo student: `DemoStudent123!`

## Demo studenti

Seed trenutno po defaultu stvara 4 demo studenta:

- `demo.student@carefree.local`
- `lea.student@carefree.local`
- `ivan.student@carefree.local`
- `petra.student@carefree.local`

Točan lokalni snapshot svih accounta nakon seedanja zapisuje se i u:

```text
generated/LOCAL_DEMO_CREDENTIALS.md
```

## Trenutni lokalni seed najčešće daje 15 demo caretakera

Primjeri:

- `ana.maric.04@demo.carefree.local`
- `dora.blazevic.15@demo.carefree.local`
- `filip.horvat.01@demo.carefree.local`
- `iva.novak.06@demo.carefree.local`
- `ivan.kovacevic.02@demo.carefree.local`

Ako promijeniš slike u `demo_profiles/` i ponovno seed-aš, lista se može promijeniti.
