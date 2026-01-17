from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import JournalEntry
from .serializers import JournalEntrySerializer
from django.http import JsonResponse
from django.utils import timezone
import json


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
    def perform_create(self, serializer):
        serializer.save(student=self.request.user)

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
