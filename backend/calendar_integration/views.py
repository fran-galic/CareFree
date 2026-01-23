# API views za calendar_integration aplikaciju
# Sadrži admin-only endpoint-e za listu događaja, pokretanje sinkronizacije i
# kreiranje događaja u Google Calendaru

from typing import ClassVar
from django.core.management import CommandError

try:
    from googleapiclient.errors import HttpError
except ImportError:
    HttpError = Exception

from django.conf import settings
from django.core.management import call_command
from rest_framework.permissions import IsAdminUser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .google_client import create_event
from .models import Calendar, CalendarEvent
from .serializers import CalendarEventSerializer
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.utils import timezone
import json

try:
    from google_auth_oauthlib.flow import Flow
except Exception:
    Flow = None

from .models import GoogleCredential


class GoogleCalendarStatusView(APIView):
    """Check if the authenticated caretaker has connected their Google Calendar."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'caretaker'):
            return Response({'detail': 'Only caretakers can check Google Calendar status'}, status=403)

        try:
            gc = GoogleCredential.objects.filter(user=request.user).first()
            if gc and gc.access_token:
                return Response({
                    'connected': True,
                    'expires_at': gc.expires_at.isoformat() if gc.expires_at else None,
                })
        except Exception:
            pass

        return Response({'connected': False})


class GoogleDisconnectView(APIView):
    """Disconnect the authenticated caretaker's Google account and (best-effort) revoke tokens."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not hasattr(request.user, 'caretaker'):
            return Response({'detail': 'Only caretakers can disconnect Google Calendar'}, status=403)

        try:
            gc = GoogleCredential.objects.filter(user=request.user).first()
        except Exception:
            gc = None

        if not gc:
            return Response({'status': 'no_credentials'}, status=200)

        # attempt to revoke token at Google's endpoint (best-effort)
        try:
            info = gc.get_authorized_user_info()
            token = info.get('token')
            if token:
                import requests
                resp = requests.post('https://oauth2.googleapis.com/revoke', params={'token': token})
                # ignore response status; best-effort
        except Exception:
            pass

        # delete stored credentials
        try:
            gc.delete()
        except Exception:
            return Response({'status': 'error', 'detail': 'failed to remove credentials'}, status=500)

        return Response({'status': 'disconnected'})


#prikaz nedavnih događaja pohranjenih u lokalnoj bazi
class CalendarEventList(APIView):
    #admin-only view: vraća nedavne događaje pohranjene lokalno
    permission_classes: ClassVar[list[type]] = [IsAdminUser]

    def get(self, request: Request) -> Response:
        #vraća do 200 najnovijih događaja
        qs = CalendarEvent.objects.all().order_by("-start")[:200]
        serializer = CalendarEventSerializer(qs, many=True)
        return Response(serializer.data)


#endpoint za trenutno pokretanje sinkronizacije (admin)
class SyncNowView(APIView):
    permission_classes: ClassVar[list[type]] = [IsAdminUser]

    def post(self, request: Request) -> Response:
        # Pokreće management naredbu koja sinkronizira Google Calendar u DB
        try:
            call_command("sync_google_calendar")
            return Response({"status": "sync_triggered"})
        except (CommandError, OSError) as exc:  # pragma: no cover - expected failures
            return Response({"status": "error", "detail": str(exc)}, status=500)


#endpoint za kreiranje događaja u Google kalendaru i spremanje lokalno (admin)
class CreateEventView(APIView):
    permission_classes: ClassVar[list[type]] = [IsAdminUser]

    def post(self, request: Request) -> Response:
        data = request.data
        summary = data.get("summary")
        if not summary:
            return Response({"detail": "summary is required"}, status=400)

        description = data.get("description")
        start = data.get("start")
        end = data.get("end")
        attendees = data.get("attendees")
        create_conf = bool(data.get("create_conference", False))

        calendar_id = getattr(settings, "GOOGLE_CALENDAR_ID", "primary")

        try:
            ev = create_event(
                calendar_id,
                summary=summary,
                description=description,
                start=start,
                end=end,
                attendees=attendees,
                create_conference=create_conf,
            )
        except (HttpError, OSError) as exc:
            return Response({"status": "error", "detail": str(exc)}, status=500)

        cal_obj, _ = Calendar.objects.get_or_create(
            calendar_id=calendar_id, defaults={"name": calendar_id},
        )

        start_dt = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date")
        end_dt = ev.get("end", {}).get("dateTime") or ev.get("end", {}).get("date")

        obj, created = CalendarEvent.objects.update_or_create(
            google_event_id=ev.get("id"),
            defaults={
                "calendar": cal_obj,
                "summary": ev.get("summary", ""),
                "description": ev.get("description", ""),
                "start": start_dt,
                "end": end_dt,
                "meet_link": None,
                "raw": ev,
            },
        )

        serializer = CalendarEventSerializer(obj)
        return Response({"created": created, "event": serializer.data})


class GoogleConnectView(APIView):
    """Return Google OAuth consent URL for the authenticated caretaker."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # require caretaker
        if not hasattr(request.user, 'caretaker'):
            return Response({'detail': 'Only caretakers can connect Google Calendar'}, status=403)

        client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', None)
        client_secret = getattr(settings, 'GOOGLE_OAUTH_CLIENT_SECRET', None)
        redirect_uri = getattr(settings, 'GOOGLE_OAUTH_REDIRECT_URI', None)
        if not client_id or not client_secret or not redirect_uri or Flow is None:
            return Response({'detail': 'OAuth not configured on this server'}, status=500)

        client_config = {
            'web': {
                'client_id': client_id,
                'client_secret': client_secret,
                'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                'token_uri': 'https://oauth2.googleapis.com/token',
            }
        }
        scopes = [
            'https://www.googleapis.com/auth/calendar',
        ]

        flow = Flow.from_client_config(client_config, scopes=scopes, redirect_uri=redirect_uri)
        auth_url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true', prompt='consent')
        # store state in session for CSRF-like check (best-effort)
        try:
            request.session['google_oauth_state'] = state
        except Exception:
            pass
        return Response({'auth_url': auth_url})


class GoogleOAuthCallbackView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # handle OAuth callback with ?code=...
        if not hasattr(request.user, 'caretaker'):
            return Response({'detail': 'Only caretakers can connect Google Calendar'}, status=403)

        if Flow is None:
            return Response({'detail': 'google-auth-oauthlib not installed on server'}, status=500)

        code = request.query_params.get('code')
        state = request.query_params.get('state')
        client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', None)
        client_secret = getattr(settings, 'GOOGLE_OAUTH_CLIENT_SECRET', None)
        redirect_uri = getattr(settings, 'GOOGLE_OAUTH_REDIRECT_URI', None)
        if not code or not client_id or not client_secret or not redirect_uri:
            return Response({'detail': 'Missing OAuth parameters'}, status=400)

        client_config = {
            'web': {
                'client_id': client_id,
                'client_secret': client_secret,
                'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                'token_uri': 'https://oauth2.googleapis.com/token',
            }
        }

        # Don't specify scopes in callback - accept whatever Google returns
        flow = Flow.from_client_config(client_config, scopes=None, redirect_uri=redirect_uri)
        # if state present in session, set it
        try:
            sess_state = request.session.get('google_oauth_state')
            if sess_state:
                flow.state = sess_state
        except Exception:
            pass

        try:
            flow.fetch_token(code=code)
        except Exception as exc:
            return Response({'detail': 'Token exchange failed', 'error': str(exc)}, status=400)

        creds = flow.credentials
        # persist token into GoogleCredential model (scaffold)
        try:
            gc, _ = GoogleCredential.objects.update_or_create(
                user=request.user,
                defaults={
                    'access_token': getattr(creds, 'token', None),
                    'refresh_token': getattr(creds, 'refresh_token', None),
                    'token_uri': getattr(creds, 'token_uri', None),
                    'client_id': client_id,
                    'client_secret': client_secret,
                    'scopes': json.dumps(getattr(creds, 'scopes', [])),
                    'expires_at': getattr(creds, 'expiry', None),
                }
            )
        except Exception as exc:
            return Response({'detail': 'Failed to save credentials', 'error': str(exc)}, status=500)

        # Redirect to frontend availability page after successful connection
        from django.shortcuts import redirect
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3001')
        return redirect(f'{frontend_url}/carefree/availability?calendar_connected=true')
