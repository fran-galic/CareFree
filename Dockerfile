FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt

RUN pip install --upgrade pip \
    && pip install -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY demo_profiles/ /app/demo_profiles/

WORKDIR /app/backend

EXPOSE 8000

CMD sh -c "gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT:-8000}"
