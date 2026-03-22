# Frontend Tests

Frontend trenutno ima 2 Jest test suitea i ukupno 6 testova.

Status:

- 2 suitea
- 6 testova
- svi prolaze

## Pokretanje

```bash
cd frontend
pnpm test -- --runInBand
```

## Pokriveni dijelovi

### `fetchers/__tests__/fetcher.test.ts`

- uspješan API poziv
- HTTP error handling
- network error handling

### `fetchers/__tests__/users.test.ts`

- dohvat help kategorija
- search s praznim queryjem
- poziv nepostojeće funkcije kao zaštita od regresije

## Ograničenja

Ovi testovi ne pokrivaju UI komponente ni end-to-end tokove. Frontend i dalje treba ručni QA za:

- onboarding
- assistant chat
- booking
- kalendar
- caretaker availability
