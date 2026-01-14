
from django.urls import path

from .views import (
    AssistantSummaryDetailView,
    AssistantSummaryListView,
    EndSesssionView,
    SessionMessageView,
    StartSessionView,
)


urlpatterns = [
    path("session/start", StartSessionView.as_view(), name="assistant-start-session"),
    path("session/message", SessionMessageView.as_view(), name="assistant-session-message"),
    path("session/end", EndSesssionView.as_view(), name="assistant-end-session"),
    path("summaries", AssistantSummaryListView.as_view(), name="assistant-summary-list"),
    path("summaries/<int:pk>", AssistantSummaryDetailView.as_view(), name="assistant-summary-detail"),
]