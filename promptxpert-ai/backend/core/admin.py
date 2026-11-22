from django.contrib import admin
from .models import GeneratedPrompt, ImageAnalysis, SystemEvent

admin.site.register(ImageAnalysis)
admin.site.register(GeneratedPrompt)
admin.site.register(SystemEvent)
