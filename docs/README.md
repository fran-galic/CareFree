# CareFree Documentation

This directory contains project documentation beyond the root README. The goal is to keep the repository front page readable while preserving the architecture, setup, research and operational context needed to understand the project.

## Core

- [Architecture](architecture.md): system structure, modules and data flow.
- [AI Assistant](ai-assistant.md): Julija assistant, NLP flow, safety behavior and recommendation logic.
- [External Services](external-services.md): OpenAI, email, Google Calendar/Meet, B2 and encryption setup.
- [Deployment](deployment.md): Vercel/Railway-oriented production deployment notes.
- [Testing](testing/README.md): backend and frontend test commands and coverage.

## Features

- [Psychologist availability](features/caretaker-availability.md): one-hour availability slots and booking rules.
- [Psychologist verification](features/caretaker-verification.md): psychologist onboarding and profile completion.

## Operations

- [Local setup and seeding](operations/local-setup-and-seeding.md)
- [Demo accounts](operations/demo-accounts.md)
- [Demo handoff](operations/demo-handoff.md)
- [Demo reset](operations/demo-reset.md)
- [Project status](operations/project-status.md)

Operational documents intentionally avoid publishing real passwords or private credentials. Generated credential snapshots stay local.

## Research And Ethics

- [Research materials](research/README.md)
- [Ethics materials](ethics/README.md)
- [Repository audit](research/audits/repository-audit.md)
- [Targeted audit](research/audits/targeted-audit.md)

The research directory contains methodological notes, audit artefacts and diagram sources used to describe the system beyond implementation code.
