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


class GoogleCredential(models.Model):
    """Store per-user Google OAuth credentials (scaffold).

    Note: tokens are sensitive. For production, store encrypted and rotate keys.
    """
    from django.conf import settings

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='google_credential')
    access_token = models.TextField(blank=True, null=True)
    refresh_token = models.TextField(blank=True, null=True)
    token_uri = models.CharField(max_length=255, blank=True, null=True)
    client_id = models.CharField(max_length=255, blank=True, null=True)
    client_secret = models.CharField(max_length=255, blank=True, null=True)
    scopes = models.TextField(blank=True, null=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"GoogleCredential({self.user})"

    def _get_fernet(self):
        try:
            from cryptography.fernet import Fernet
        except Exception:
            return None
        key = None
        from django.conf import settings
        key = getattr(settings, 'ENCRYPTION_KEY', None)
        if not key:
            return None
        try:
            return Fernet(key.encode())
        except Exception:
            return None

    def _encrypt(self, plaintext: str | None) -> str | None:
        if not plaintext:
            return plaintext
        f = self._get_fernet()
        if not f:
            return plaintext
        try:
            return f.encrypt(plaintext.encode()).decode()
        except Exception:
            return plaintext

    def _decrypt(self, ciphertext: str | None) -> str | None:
        if not ciphertext:
            return ciphertext
        f = self._get_fernet()
        if not f:
            return ciphertext
        try:
            return f.decrypt(ciphertext.encode()).decode()
        except Exception:
            return ciphertext

    def get_authorized_user_info(self) -> dict:
        """Return a dict compatible with google.oauth2.credentials.Credentials.from_authorized_user_info()

        This will transparently decrypt stored tokens if encryption is enabled in settings.
        """
        info = {
            'token': self._decrypt(self.access_token) if self.access_token else None,
            'refresh_token': self._decrypt(self.refresh_token) if self.refresh_token else None,
            'token_uri': self.token_uri,
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'scopes': self.scopes.split(',') if self.scopes else [],
        }
        return info

    def refresh_if_needed(self, force: bool = False) -> bool:
        """Refresh access token using refresh_token when near expiry or when forced.

        Returns True if tokens were updated and saved, False otherwise.
        """
        try:
            from google.oauth2.credentials import Credentials as UserCredentials
            from google.auth.transport.requests import Request
        except Exception:
            return False


class SystemGoogleCredential(models.Model):
    """Store OAuth credentials for the shared project Google account."""

    key = models.CharField(max_length=100, unique=True, default="shared_calendar")
    google_account_email = models.EmailField(blank=True, null=True)
    access_token = models.TextField(blank=True, null=True)
    refresh_token = models.TextField(blank=True, null=True)
    token_uri = models.CharField(max_length=255, blank=True, null=True)
    client_id = models.CharField(max_length=255, blank=True, null=True)
    client_secret = models.CharField(max_length=255, blank=True, null=True)
    scopes = models.TextField(blank=True, null=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"SystemGoogleCredential({self.google_account_email or self.key})"

    def _get_fernet(self):
        try:
            from cryptography.fernet import Fernet
        except Exception:
            return None
        from django.conf import settings
        key = getattr(settings, 'ENCRYPTION_KEY', None)
        if not key:
            return None
        try:
            return Fernet(key.encode())
        except Exception:
            return None

    def _encrypt(self, plaintext: str | None) -> str | None:
        if not plaintext:
            return plaintext
        f = self._get_fernet()
        if not f:
            return plaintext
        try:
            return f.encrypt(plaintext.encode()).decode()
        except Exception:
            return plaintext

    def _decrypt(self, ciphertext: str | None) -> str | None:
        if not ciphertext:
            return ciphertext
        f = self._get_fernet()
        if not f:
            return ciphertext
        try:
            return f.decrypt(ciphertext.encode()).decode()
        except Exception:
            return ciphertext

    def get_authorized_user_info(self) -> dict:
        return {
            'token': self._decrypt(self.access_token) if self.access_token else None,
            'refresh_token': self._decrypt(self.refresh_token) if self.refresh_token else None,
            'token_uri': self.token_uri,
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'scopes': self.scopes.split(',') if self.scopes else [],
        }

    def refresh_if_needed(self, force: bool = False) -> bool:
        try:
            from google.oauth2.credentials import Credentials as UserCredentials
            from google.auth.transport.requests import Request
        except Exception:
            return False

        import datetime as _dt
        now = _dt.datetime.utcnow()
        if self.expires_at and not force:
            if (self.expires_at - _dt.timedelta(minutes=5)) > now.replace(tzinfo=None):
                return False

        info = self.get_authorized_user_info()
        creds = UserCredentials(
            token=info.get('token'),
            refresh_token=info.get('refresh_token'),
            token_uri=info.get('token_uri'),
            client_id=info.get('client_id'),
            client_secret=info.get('client_secret'),
            scopes=info.get('scopes') or None,
        )
        try:
            creds.refresh(Request())
        except Exception:
            return False

        try:
            self.access_token = self._encrypt(creds.token) if creds.token else None
            if getattr(creds, 'refresh_token', None):
                self.refresh_token = self._encrypt(creds.refresh_token)
            if getattr(creds, 'expiry', None):
                self.expires_at = creds.expiry
            self.save(update_fields=['access_token', 'refresh_token', 'expires_at', 'updated_at'])
            return True
        except Exception:
            return False

        # decide whether to refresh
        import datetime as _dt
        now = _dt.datetime.utcnow()
        if self.expires_at and not force:
            # refresh if expiring within 5 minutes
            if (self.expires_at - _dt.timedelta(minutes=5)) > now.replace(tzinfo=None):
                return False

        info = self.get_authorized_user_info()
        creds = UserCredentials(
            token=info.get('token'),
            refresh_token=info.get('refresh_token'),
            token_uri=info.get('token_uri'),
            client_id=info.get('client_id'),
            client_secret=info.get('client_secret'),
            scopes=info.get('scopes') or None,
        )
        try:
            creds.refresh(Request())
        except Exception:
            return False

        # store refreshed tokens (encrypt if enabled)
        try:
            self.access_token = self._encrypt(creds.token) if creds.token else None
            # refresh_token may be rotated by provider
            if getattr(creds, 'refresh_token', None):
                self.refresh_token = self._encrypt(creds.refresh_token)
            # expires_at: convert to aware datetime in UTC
            if getattr(creds, 'expiry', None):
                self.expires_at = creds.expiry
            self.save(update_fields=['access_token', 'refresh_token', 'expires_at'])
            return True
        except Exception:
            return False


class ReconcileLog(models.Model):
    """Log of reconciliation runs and differences found between Google and local DB.

    This is read-only by default: entries describe differences so an operator
    can inspect before any automatic fixes are applied.
    """
    calendar = models.ForeignKey(Calendar, on_delete=models.SET_NULL, null=True, blank=True)
    google_event_id = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=50, help_text='missing_locally|missing_in_google|changed')
    details = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"ReconcileLog({self.status}, {self.google_event_id})"
