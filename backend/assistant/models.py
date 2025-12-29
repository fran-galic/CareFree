from django.db import models
from django.db.models import Q

from accounts.models import Student


class AssistantSession(models.Model):
	student = models.ForeignKey(
		Student,
		related_name="assistant_sessions",
		on_delete=models.CASCADE,
	)
	is_active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)
	ended_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		ordering = ["-created_at"]
		constraints = [
			models.UniqueConstraint(
				fields=["student"],
				condition=Q(is_active=True),
				name="one_active_assistant_session_per_student",
			)
		]

	def __str__(self) -> str:
		return f"AssistantSession(id={self.pk}, student={self.student.user.email})"


class AssistantMessage(models.Model):
	SENDER_STUDENT = "student"
	SENDER_BOT = "bot"

	SENDER_CHOICES = [
		(SENDER_STUDENT, "Student"),
		(SENDER_BOT, "Bot"),
	]

	session = models.ForeignKey(
		AssistantSession,
		related_name="messages",
		on_delete=models.CASCADE,
	)
	sender = models.CharField(max_length=20, choices=SENDER_CHOICES)
	content = models.TextField()
	sequence = models.PositiveIntegerField(null=True, blank=True, editable=False)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["sequence", "created_at"]

	def save(self, *args, **kwargs) -> None:
		if self.sequence is None:
			last_message = (
				AssistantMessage.objects.filter(session=self.session)
				.order_by("-sequence")
				.first()
			)
			if last_message and last_message.sequence is not None:
				self.sequence = last_message.sequence + 1
			else:
				self.sequence = 1
		super().save(*args, **kwargs)

	def __str__(self) -> str:
		return f"Message(session_id={self.session_id}, sender={self.sender})"


class AssistantSessionSummary(models.Model):
	student = models.ForeignKey(
		Student,
		related_name="assistant_session_summaries",
		on_delete=models.CASCADE,
	)
	session = models.OneToOneField(
		AssistantSession,
		related_name="summary",
		null=True,
		blank=True,
		on_delete=models.SET_NULL,
	)
	content = models.TextField()
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self) -> str:
		return f"Summary(id={self.pk}, student={self.student_id})"

