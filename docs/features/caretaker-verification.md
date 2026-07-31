# Psychologist Verification And Profile Completion

This document describes the implemented onboarding and profile-completion flow for psychologists. Internal model and route names still use `caretaker`.

## Main Page

```text
/carefree/profile/caretaker
```

## Profile Data

A psychologist can provide:

- profile image
- CV
- one or more diplomas
- certificates
- phone number
- professional description
- graduation year
- help categories
- work approach
- contact visibility preferences for students

## Backend Endpoints

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

## Completion Rules

Relevant fields:

- `is_profile_complete`
- `approval_status`
- `is_approved`

A profile is considered complete when it has:

- phone number
- profile image
- professional description
- at least one help category
- CV
- at least one diploma

Admin approval is still required after completion.

## Related Files

- `backend/accounts/models.py`
- `backend/accounts/views.py`
- `frontend/app/carefree/profile/caretaker/page.tsx`
- `frontend/fetchers/users.ts`
