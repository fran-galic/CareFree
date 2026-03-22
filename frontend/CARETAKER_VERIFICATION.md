# Caretaker Verification / Profile Completion

Ovaj dokument opisuje trenutno implementiran caretaker onboarding i profile-completion flow.

## Glavna stranica

- `/carefree/profile/caretaker`

## Što korisnik može napraviti

- uploadati profilnu sliku
- uploadati CV
- uploadati jednu ili više diploma
- uploadati certifikate
- unijeti telefon
- unijeti `about_me`
- unijeti godinu diplomiranja
- odabrati help kategorije
- kontrolirati prikaz emaila i telefona studentima

## Backend endpointi

- `GET /auth/caretaker/register/`
- `POST /auth/caretaker/register/`
- `PATCH /auth/caretaker/register/`
- `POST /auth/caretaker/cv/`
- `DELETE /auth/caretaker/cv/`
- `POST /auth/caretaker/diploma/`
- `DELETE /auth/caretaker/diploma/<id>/`
- `POST /auth/caretaker/certificate/`
- `DELETE /auth/caretaker/certificate/<id>/`
- `POST /auth/caretaker/image/`
- `DELETE /auth/caretaker/image/`

## Stanje profila

Relevantna polja:

- `is_profile_complete`
- `approval_status`
- `is_approved`

`is_profile_complete` ovisi o stvarnoj cjelovitosti profila i uploadova, ne samo o jednom requestu.

## Trenutna validacija

Profil da bi bio kompletan treba imati:

- telefon
- profilnu sliku
- `about_me`
- barem jednu help kategoriju
- CV
- barem jednu diplomu

## Što nije automatski riješeno

- admin notifikacije za novu prijavu nisu centralni dio ovog flowa
- finalno odobrenje i dalje ide kroz admin proces

## Povezani frontend fileovi

- `frontend/app/carefree/profile/caretaker/page.tsx`
- `frontend/fetchers/users.ts`
