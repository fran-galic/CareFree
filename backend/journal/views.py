from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import JournalEntry
from .serializers import JournalEntrySerializer
from .ai import classify_journal_safety
from .safety import CRISIS_SUPPORT_NOTE, journal_analysis_allowed, looks_like_crisis_content
from django.http import JsonResponse
from django.utils import timezone
import json
import logging


logger = logging.getLogger(__name__)


class IsOwnerOrReadOnly(permissions.BasePermission):
    #definira dopuštenja: samo vlasnik unosa može mijenjati, ostali mogu samo čitati(zapravo i dalje samo vlasnik)
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.student == request.user


class JournalEntryViewSet(viewsets.ModelViewSet):
    queryset = JournalEntry.objects.all().order_by('-created_at')
    
    #definira kako ćemo pretvaradi podatke u JSON i obrnuto
    serializer_class = JournalEntrySerializer
    
    #definira tko ima pristup
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    #kod kreiranja unosa, automatski postavimo studenta na trenutno prijavljenog korisnika
    def _analysis_fields(self, content: str) -> dict:
        if not content:
            return {
                "analysis_summary": None,
                "crisis_detected": False,
            }

        heuristic_crisis = looks_like_crisis_content(content)
        if heuristic_crisis:
            return {
                "analysis_summary": CRISIS_SUPPORT_NOTE,
                "crisis_detected": True,
            }

        if not journal_analysis_allowed(self.request.user.id):
            return {
                "analysis_summary": None,
                "crisis_detected": False,
            }

        try:
            result = classify_journal_safety(content)
            return {
                "analysis_summary": CRISIS_SUPPORT_NOTE if result.crisis_detected else None,
                "crisis_detected": bool(result.crisis_detected),
            }
        except Exception as exc:
            logger.warning("journal_ai_safety_fallback error=%s", exc)

        return {
            "analysis_summary": None,
            "crisis_detected": False,
        }

    def perform_create(self, serializer):
        content = serializer.validated_data.get("content") or ""
        serializer.save(student=self.request.user, **self._analysis_fields(content))

    def perform_update(self, serializer):
        content = serializer.validated_data.get("content")
        if content is None:
            content = serializer.instance.content or ""
        serializer.save(**self._analysis_fields(content))

    #ograničavamo prikaz unosa samo na one koje je kreirao prijavljeni korisnik
    def get_queryset(self):
        user = self.request.user
        if user and user.is_authenticated:
            return JournalEntry.objects.filter(student=user).order_by('-created_at')
        return JournalEntry.objects.none()

    #API endpoint koji korisniku omogućuje da preuzme sve svoje dnevničke unose u JSON formatu
    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        user = request.user
        qs = JournalEntry.objects.filter(student=user).order_by('-created_at')
        serializer = self.get_serializer(qs, many=True)
        payload = json.dumps(serializer.data, default=str, ensure_ascii=False)
        filename = f"journal_export_{user.pk}_{timezone.now().strftime('%Y%m%dT%H%M%S')}.json"
        response = JsonResponse(serializer.data, safe=False, json_dumps_params={'ensure_ascii': False})
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
