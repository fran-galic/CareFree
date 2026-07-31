# Demo Handoff

This document is a safe handoff checklist for a deployed CareFree demo. It intentionally avoids storing real passwords, API keys, OAuth secrets or private shared-account details.

## Links

Record active deployment links here for the specific demo environment:

```text
Frontend: <frontend-url>
Backend: <backend-url>
Admin: <backend-url>/admin/login/
OpenAPI schema: <backend-url>/schema/
```

Do not commit private credentials alongside these links.

## Accounts

Use the current generated credential snapshot from the target environment or create accounts manually through admin/seed commands.

Local seed snapshots are written to:

```text
generated/LOCAL_DEMO_CREDENTIALS.md
```

This file is ignored by Git and should be shared only out of band.

## Demo Readiness Checklist

Before sharing a demo environment:

- backend is deployed from the latest commit
- frontend is deployed from the latest commit
- migrations have run successfully
- help categories are seeded
- demo accounts are seeded or manually prepared
- admin password is stored outside the repository
- OpenAI key is configured if Julija should use model-backed responses
- email provider is configured if notification emails should be sent
- shared Google Calendar account is connected if Meet links should be generated
- media storage is configured if uploaded documents/images need to persist
- `python manage.py check_external_services` has been reviewed

## Demo Reset

Use [demo-reset.md](demo-reset.md) for the reset procedure. Database resets remove stored shared Google OAuth credentials, so the shared Calendar account must be connected again after a clean reset.

## Cost Notes

Actual cost depends on the hosting plan and usage. For small demos, the variable parts are usually:

- backend hosting
- OpenAI usage
- email volume
- media storage
- database/storage retention

Check current provider pricing before committing to a public or longer-running demo.
