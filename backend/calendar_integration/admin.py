from django.contrib import admin

from .models import Calendar, CalendarEvent


@admin.register(Calendar)
class CalendarAdmin(admin.ModelAdmin):
    list_display = ("calendar_id", "name")


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ("google_event_id", "summary", "start", "end", "meet_link", "synced_at")
    search_fields = ("google_event_id", "summary")
