from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError

from accounts.models import Student, Caretaker


class Availability(models.Model):
    caretaker = models.ForeignKey(Caretaker, related_name="availabilities", on_delete=models.CASCADE)
    start = models.DateTimeField()
    end = models.DateTimeField()
    timezone = models.CharField(max_length=50, blank=True, null=True)
    slot_duration_minutes = models.PositiveIntegerField(default=60)
    recurrence_rule = models.TextField(blank=True, null=True)
    note = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["caretaker", "start"]
        indexes = [models.Index(fields=["caretaker", "start"]), models.Index(fields=["caretaker", "end"])]

    def clean(self):
        if self.end <= self.start:
            raise ValidationError("Availability end must be after start")
        if self.slot_duration_minutes <= 0:
            raise ValidationError("slot_duration_minutes must be > 0")

    def __str__(self):
        return f"Availability({self.caretaker}, {self.start.isoformat()} -> {self.end.isoformat()})"


class AppointmentRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_REJECTED = "rejected"
    STATUS_CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    student = models.ForeignKey(Student, related_name="appointment_requests", on_delete=models.SET_NULL, null=True, blank=True)
    caretaker = models.ForeignKey(Caretaker, related_name="appointment_requests", on_delete=models.CASCADE)
    requested_start = models.DateTimeField()
    requested_end = models.DateTimeField()
    message = models.TextField(blank=True, null=True)
    ai_summary = models.TextField(blank=True, null=True)
    ai_category = models.CharField(max_length=100, blank=True, null=True)
    crisis_flag = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["caretaker", "status"]), models.Index(fields=["student", "status"])]

    def clean(self):
        if self.requested_end <= self.requested_start:
            raise ValidationError("requested_end must be after requested_start")
        delta = self.requested_end - self.requested_start
        if delta.total_seconds() != 3600:
            raise ValidationError("Requested slot must be exactly 1 hour")

    def __str__(self):
        s = f"{self.caretaker} requested {self.requested_start.isoformat()}"
        if self.student:
            s = f"{self.student} -> {s}"
        return s


class Appointment(models.Model):
    STATUS_CONFIRMED_PENDING = "confirmed_pending_sync"
    STATUS_CONFIRMED = "confirmed"
    STATUS_SYNC_FAILED = "confirmed_sync_failed"
    STATUS_CANCELLED = "cancelled"
    STATUS_COMPLETED = "completed"

    STATUS_CHOICES = [
        (STATUS_CONFIRMED_PENDING, "Confirmed (pending sync)"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_SYNC_FAILED, "Confirmed (sync failed)"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_COMPLETED, "Completed"),
    ]

    appointment_request = models.OneToOneField(AppointmentRequest, related_name="appointment", on_delete=models.CASCADE)
    caretaker = models.ForeignKey(Caretaker, related_name="appointments", on_delete=models.CASCADE)
    student = models.ForeignKey(Student, related_name="appointments", on_delete=models.SET_NULL, null=True, blank=True)
    start = models.DateTimeField()
    end = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_CONFIRMED_PENDING)
    external_event_id = models.CharField(max_length=200, blank=True, null=True)
    calendar_id = models.CharField(max_length=200, blank=True, null=True)
    conference_link = models.URLField(blank=True, null=True)
    metadata = models.JSONField(blank=True, null=True)
    cancelled_by = models.CharField(max_length=100, blank=True, null=True)
    cancellation_reason = models.TextField(blank=True, null=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start"]
        indexes = [models.Index(fields=["caretaker", "start"]), models.Index(fields=["external_event_id"]), models.Index(fields=["status"])]

    def clean(self):
        if self.end <= self.start:
            raise ValidationError("Appointment end must be after start")
        delta = self.end - self.start
        if delta.total_seconds() != 3600:
            raise ValidationError("Appointment duration must be exactly 1 hour")

    def cancel(self, cancelled_by_user, reason=None):
        self.status = self.STATUS_CANCELLED
        self.cancelled_by = getattr(cancelled_by_user, "email", str(cancelled_by_user))
        self.cancellation_reason = reason
        self.cancelled_at = timezone.now()
        self.save(update_fields=["status", "cancelled_by", "cancellation_reason", "cancelled_at"])

    def __str__(self):
        return f"Appointment({self.caretaker}, {self.start.isoformat()})"


class CalendarEventLog(models.Model):
    OP_CREATE = "create"
    OP_UPDATE = "update"
    OP_DELETE = "delete"

    OP_CHOICES = [
        (OP_CREATE, "create"),
        (OP_UPDATE, "update"),
        (OP_DELETE, "delete"),
    ]

    appointment = models.ForeignKey(Appointment, related_name="calendar_logs", on_delete=models.SET_NULL, null=True, blank=True)
    operation = models.CharField(max_length=20, choices=OP_CHOICES)
    external_id = models.CharField(max_length=200, blank=True, null=True)
    request_payload = models.JSONField(null=True, blank=True)
    response_payload = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, blank=True, null=True)
    attempts = models.IntegerField(default=0)
    last_attempted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"CalendarEventLog({self.operation}, {self.external_id})"


class AvailabilitySlot(models.Model):
    """Explicit per-slot availability toggles for a caretaker.

    Slots are stored as discrete hour-long ranges (start..end) in UTC.
    The frontend will request slots for a caretaker for the next N days
    and the backend will compute availability by combining these toggles
    with confirmed Appointments.
    """
    caretaker = models.ForeignKey(Caretaker, related_name="availability_slots", on_delete=models.CASCADE)
    start = models.DateTimeField()
    end = models.DateTimeField()
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["caretaker", "start"]
        indexes = [models.Index(fields=["caretaker", "start"])]
        unique_together = [("caretaker", "start")]

    def clean(self):
        if self.end <= self.start:
            raise ValidationError("AvailabilitySlot end must be after start")
        delta = self.end - self.start
        if delta.total_seconds() != 3600:
            raise ValidationError("AvailabilitySlot must be exactly 1 hour")

    def __str__(self):
        return f"AvailabilitySlot({self.caretaker}, {self.start.isoformat()}, available={self.is_available})"


class ReservationHold(models.Model):
    """Temporary hold on a slot created when a student starts the booking flow.

    A hold reserves a 1-hour slot for a short period (e.g. 10 minutes) to prevent race
    conditions while the student fills the booking form. Holds automatically expire.
    """
    STATUS_ACTIVE = 'active'
    STATUS_EXPIRED = 'expired'
    STATUS_CONSUMED = 'consumed'

    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_EXPIRED, 'Expired'),
        (STATUS_CONSUMED, 'Consumed'),
    ]

    student = models.ForeignKey('accounts.Student', related_name='holds', on_delete=models.SET_NULL, null=True, blank=True)
    caretaker = models.ForeignKey(Caretaker, related_name='holds', on_delete=models.CASCADE)
    start = models.DateTimeField()
    end = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['caretaker', 'start']), models.Index(fields=['status'])]

    def is_active(self):
        from django.utils import timezone
        return self.status == self.STATUS_ACTIVE and (self.expires_at is None or self.expires_at > timezone.now())

    def mark_expired(self):
        self.status = self.STATUS_EXPIRED
        self.save(update_fields=['status'])

    def consume(self):
        self.status = self.STATUS_CONSUMED
        self.save(update_fields=['status'])

    def __str__(self):
        return f"ReservationHold({self.caretaker}, {self.start.isoformat()}, status={self.status})"
