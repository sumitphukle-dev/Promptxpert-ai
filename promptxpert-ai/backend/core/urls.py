from django.urls import path
from . import views as v

urlpatterns = [
    path("health", v.Health.as_view()),
    path("auth/register", v.Register.as_view()),
    path("auth/login", v.Login.as_view()),
    path("auth/me", v.Me.as_view()),
    path("analyze", v.Analyze.as_view()),
    path("prompt/compose", v.Compose.as_view()),
    path("prompt/variations", v.Variations.as_view()),
    path("prompt/transform", v.Transform.as_view()),
    path("compare", v.Compare.as_view()),
    path("stats", v.Stats.as_view()),
    path("history", v.History.as_view()),
    path("history/<int:pk>", v.HistoryItem.as_view()),
    path("history/<int:pk>/share", v.Share.as_view()),
    path("history/<int:pk>/report", v.Report.as_view()),
    path("share/<str:token>", v.Shared.as_view()),
]
