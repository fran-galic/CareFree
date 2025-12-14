from django.db import models
from django.conf import settings


class JournalEntry(models.Model):
    #povezivanje unosa sa studentom
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='journal_entries'
    )

    title = models.CharField(max_length=200, blank=True, null=True)
    
    #spremanje enkriptiranog sadržaja
    content_encrypted = models.BinaryField(blank=True, null=True)
    
    #getter za content koji dekriptira prije vraćanja
    @property
    def content(self):
        from cryptography.fernet import Fernet
        key = getattr(settings, 'ENCRYPTION_KEY', None)
        if not key or not self.content_encrypted:
            # return plain None/empty if no key or no data
            return None if self.content_encrypted is None else self.content_encrypted.decode(errors='ignore')
        f = Fernet(key.encode())
        try:
            return f.decrypt(self.content_encrypted).decode()
        except Exception:
            return None

    #setter za content koji enkriptira prije spremanja
    @content.setter
    def content(self, value):
        from cryptography.fernet import Fernet
        key = getattr(settings, 'ENCRYPTION_KEY', None)
        if not key:
            raise RuntimeError("ENCRYPTION_KEY is not set. Refusing to store plaintext content.")
        f = Fernet(key.encode())
        self.content_encrypted = f.encrypt(value.encode()) if value is not None else None
    mood = models.CharField(max_length=32, blank=True, null=True)

    #kasnije ako ćemo implementirati AI analizu
    analysis_summary = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    #za sortiranje unosa po datumu kreiranja
    class Meta:
        ordering = ['-created_at']

    #prikaz unosa u admin panelu ili shellu
    def __str__(self):
        return f"JournalEntry({self.pk}) by {self.student} @ {self.created_at}"
