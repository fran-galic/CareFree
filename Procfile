release: cd backend && python manage.py migrate --noinput && python manage.py create_superuser && python manage.py seed_help_categories && python manage.py generate_dummy_caretakers --count 45
web: cd backend && gunicorn backend.wsgi --bind 0.0.0.0:$PORT
