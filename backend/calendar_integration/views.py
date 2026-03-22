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
from django.core.cache import cache
from rest_framework.permissions import IsAdminUser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .google_client import create_event
from .models import Calendar, CalendarEvent
from .serializers import CalendarEventSerializer
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.conf import settings
from django.utils import timezone
import json

try:
    from google_auth_oauthlib.flow import Flow
except Exception:
    Flow = None

from .models import GoogleCredential, SystemGoogleCredential
from appointments.google_sync import get_shared_calendar_id


def _calendar_sync_disabled_response():
    return Response(
        {
            "detail": "Per-user Google Calendar sync is disabled. CareFree uses a shared system calendar."
        },
        status=410,
    )


class GoogleCalendarStatusView(APIView):
    """Check if the authenticated caretaker has connected their Google Calendar."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(settings, "ENABLE_USER_GOOGLE_CALENDAR_SYNC", False):
            return _calendar_sync_disabled_response()
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


class SharedGoogleCalendarStatusView(APIView):
    """Return status of the shared Google Calendar OAuth credential."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        expected_email = (getattr(settings, "GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL", "") or "").strip().lower()
        calendar_id = (getattr(settings, "GOOGLE_CALENDAR_ID", "") or "").strip()

        cred = SystemGoogleCredential.objects.filter(key="shared_calendar").first()
        if not cred:
            return Response(
                {
                    "connected": False,
                    "mode": "shared_oauth",
                    "expected_email": expected_email or None,
                    "calendar_id": calendar_id or None,
                    "detail": "Shared Google OAuth credential is not connected.",
                }
            )

        stored_email = (cred.google_account_email or "").strip().lower()
        return Response(
            {
                "connected": True,
                "mode": "shared_oauth",
                "expected_email": expected_email or None,
                "connected_email": stored_email or None,
                "calendar_id": calendar_id or None,
                "email_matches_expected": (not expected_email) or stored_email == expected_email,
                "has_refresh_token": bool(cred.refresh_token),
                "updated_at": cred.updated_at.isoformat() if cred.updated_at else None,
            }
        )


class GoogleDisconnectView(APIView):
    """Disconnect the authenticated caretaker's Google account and (best-effort) revoke tokens."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(settings, "ENABLE_USER_GOOGLE_CALENDAR_SYNC", False):
            return _calendar_sync_disabled_response()
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

        try:
            calendar_id = get_shared_calendar_id()
        except Exception as exc:
            return Response({"status": "error", "detail": str(exc)}, status=500)

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
        if not getattr(settings, "ENABLE_USER_GOOGLE_CALENDAR_SYNC", False):
            return _calendar_sync_disabled_response()
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
    permission_classes = [AllowAny]

    def get(self, request):
        if not getattr(settings, "ENABLE_USER_GOOGLE_CALENDAR_SYNC", False):
            return _calendar_sync_disabled_response()
        # handle OAuth callback with ?code=...

        if Flow is None:
            return Response({'detail': 'google-auth-oauthlib not installed on server'}, status=500)

        code = request.query_params.get('code')
        state = request.query_params.get('state')
        client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', None)
        client_secret = getattr(settings, 'GOOGLE_OAUTH_CLIENT_SECRET', None)
        redirect_uri = getattr(settings, 'GOOGLE_OAUTH_REDIRECT_URI', None)
        if not code or not client_id or not client_secret or not redirect_uri:
            return Response({'detail': 'Missing OAuth parameters'}, status=400)

        flow_meta = None
        if state:
            try:
                flow_meta = cache.get(f"google_oauth_state:{state}")
            except Exception:
                flow_meta = None

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
        if flow_meta and flow_meta.get("state"):
            flow.state = flow_meta["state"]

        try:
            flow.fetch_token(code=code)
        except Exception as exc:
            return Response({'detail': 'Token exchange failed', 'error': str(exc)}, status=400)

        creds = flow.credentials

        google_email = None
        try:
            import requests
            resp = requests.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {getattr(creds, 'token', None)}"},
                timeout=15,
            )
            if resp.ok:
                google_email = (resp.json().get("email") or "").strip().lower()
        except Exception:
            google_email = None

        expected_email = (getattr(settings, "GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL", "") or "").strip().lower()
        is_system_flow = bool(flow_meta and flow_meta.get("mode") == "system")
        if not is_system_flow and expected_email and google_email and google_email == expected_email:
            # Fallback for deployments where the OAuth state was generated by a
            # different process (for example via management shell during setup).
            is_system_flow = True

        if is_system_flow:
            if expected_email and google_email and google_email != expected_email:
                return Response(
                    {
                        "detail": "Authorized Google account does not match GOOGLE_SHARED_CALENDAR_ACCOUNT_EMAIL.",
                        "expected": expected_email,
                        "received": google_email,
                    },
                    status=400,
                )

            SystemGoogleCredential.objects.update_or_create(
                key="shared_calendar",
                defaults={
                    'google_account_email': google_email or expected_email or None,
                    'access_token': getattr(creds, 'token', None),
                    'refresh_token': getattr(creds, 'refresh_token', None),
                    'token_uri': getattr(creds, 'token_uri', None),
                    'client_id': client_id,
                    'client_secret': client_secret,
                    'scopes': ",".join(getattr(creds, 'scopes', []) or []),
                    'expires_at': getattr(creds, 'expiry', None),
                }
            )
            try:
                cache.delete(f"google_oauth_state:{state}")
            except Exception:
                pass
            from django.shortcuts import redirect
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3001')
            return redirect(f'{frontend_url}/carefree/availability?shared_calendar_connected=true')

        if not request.user.is_authenticated or not hasattr(request.user, 'caretaker'):
            return Response({'detail': 'Only authenticated caretakers can connect personal Google Calendar'}, status=403)

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


class SystemGoogleConnectView(APIView):
    """Return Google OAuth consent URL for the shared project calendar account."""
    permission_classes = [AllowAny]

    def get(self, request):
        if not getattr(settings, "ENABLE_USER_GOOGLE_CALENDAR_SYNC", False):
            return _calendar_sync_disabled_response()

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
            'openid',
            'email',
            'https://www.googleapis.com/auth/calendar',
        ]

        flow = Flow.from_client_config(client_config, scopes=scopes, redirect_uri=redirect_uri)
        auth_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
        )
        try:
            cache.set(
                f"google_oauth_state:{state}",
                {"mode": "system", "state": state},
                timeout=900,
            )
        except Exception:
            pass
        return Response({'auth_url': auth_url})
