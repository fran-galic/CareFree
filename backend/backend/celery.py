from __future__ import annotations
import os
from celery import Celery

#postavljanje Django settings modula za Celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

#inicijalizirana Celery aplikacija
app = Celery('backend')
app.config_from_object('django.conf:settings', namespace='CELERY')  #učitavanje postavki iz Django settingsa
app.autodiscover_tasks()    #automatsko pronalaženje tasks.py unutar svih Django aplikacija

#debug task za testiranje Celery postavki
@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')