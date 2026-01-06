from django.db import models



#model za Google Calendar
class Calendar(models.Model):
    calendar_id = models.CharField(max_length=255, unique=True)  # Google Calendar ID
    name = models.CharField(max_length=255, blank=True)

    def __str__(self) -> str:
        return self.name or self.calendar_id


#model za Google Calendar Event
class CalendarEvent(models.Model):
    calendar = models.ForeignKey(Calendar, on_delete=models.CASCADE, null=True, blank=True)
    google_event_id = models.CharField(max_length=255, unique=True)
    summary = models.CharField(max_length=512, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    start = models.DateTimeField()
    end = models.DateTimeField(null=True, blank=True)
    meet_link = models.URLField(null=True, blank=True)
    raw = models.JSONField(blank=True, null=True)
    synced_at = models.DateTimeField(auto_now=True)
    source_type = models.CharField(max_length=100, blank=True, null=True)
    source_id = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self) -> str:
        return f"{self.summary} ({self.google_event_id})"
