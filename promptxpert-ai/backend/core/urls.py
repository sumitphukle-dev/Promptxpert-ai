from django.urls import path
from . import views as v

urlpatterns = [
    path("health", v.Health.as_view()),
    path("auth/register", v.Register.as_view()),
    path("auth/login", v.Login.as_view()),
    path("auth/me", v.Me.as_view()),
    path("analyze", v.Analyze.as_view()),
    path("prompt/compose", v.Compose.as_view()),
    path("history", v.History.as_view()),
    path("history/<int:pk>", v.HistoryItem.as_view()),
    path("history/<int:pk>/report", v.Report.as_view()),
]
