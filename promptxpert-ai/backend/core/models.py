from django.conf import settings
from django.db import models


class ImageAnalysis(models.Model):
    """Stores results and file metadata only. Original image bytes are never saved."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="analyses")
    file_hash = models.CharField(max_length=64)
    mime_type = models.CharField(max_length=32)
    detector_score = models.FloatField(null=True, blank=True)
    detector_label = models.CharField(max_length=24, blank=True)
    provenance_status = models.CharField(max_length=32, blank=True)
    model_version = models.CharField(max_length=64, blank=True)
    latency_ms = models.PositiveIntegerField(default=0)
    verdict = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class GeneratedPrompt(models.Model):
    analysis = models.OneToOneField(ImageAnalysis, on_delete=models.CASCADE, related_name="prompt")
    visual_description_json = models.JSONField()
    final_prompt = models.TextField()
    target_style = models.CharField(max_length=24, default="detailed")
    model_id = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)


class SystemEvent(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    event_type = models.CharField(max_length=48)
    status = models.CharField(max_length=24)
    latency_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
