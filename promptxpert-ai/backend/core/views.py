import time

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import GeneratedPrompt, ImageAnalysis, SystemEvent
from .services import detector, mistral, prompts, provenance
from .services.validation import InvalidImage, validate_image

User = get_user_model()


def _tokens(user):
    r = RefreshToken.for_user(user)
    return {"access": str(r.access_token), "refresh": str(r), "user": {"id": user.id, "email": user.email}}


def _event(request, kind, ok, ms):
    SystemEvent.objects.create(user=request.user if request.user.is_authenticated else None,
                               event_type=kind, status="ok" if ok else "error", latency_ms=ms)


def build_verdict(det, prov):
    """Keeps the two evidence types separate; provenance never silently overrides the classifier."""
    notes = []
    if det:
        notes.append({"signal": "Visual classifier", "state": det["label"], "detail": det["confidence_note"]})
    if prov:
        notes.append({"signal": "Provenance", "state": prov["status"], "detail": prov["summary"]})
    if det and prov and prov["status"] == "generator_metadata":
        overall = "likely-ai" if det["label"] != "real-like" else "conflicting"
    elif det:
        overall = {"ai-like": "likely-ai", "real-like": "likely-real"}.get(det["label"], "inconclusive")
    else:
        overall = "not-assessed"
    if det and det["label"] == "real-like" and prov and prov["status"] == "generator_metadata":
        overall = "conflicting"
    return {"overall": overall, "evidence": notes,
            "disclaimer": "An estimate from automated signals. It cannot prove whether an image is real or AI-generated."}


class Health(APIView):
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        loaded = detector._try_load_model() is not None
        return Response({"ok": True, "detector": "efficientnet-b0" if loaded else "heuristic-fallback",
                         "prompt_ready": bool(__import__("os").getenv("MISTRAL_API_KEY"))})


class Register(APIView):
    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        if "@" not in email or len(email) > 150:
            return Response({"error": "Enter a valid email address."}, status=400)
        if User.objects.filter(username=email).exists():
            return Response({"error": "An account with this email already exists."}, status=400)
        try:
            validate_password(password)
        except ValidationError as e:
            return Response({"error": " ".join(e.messages)}, status=400)
        user = User.objects.create_user(username=email, email=email, password=password)  # hashed
        return Response(_tokens(user), status=201)


class Login(APIView):
    def post(self, request):
        from django.contrib.auth import authenticate
        email = (request.data.get("email") or "").strip().lower()
        user = authenticate(username=email, password=request.data.get("password") or "")
        if not user:
            return Response({"error": "Email or password is incorrect."}, status=401)
        return Response(_tokens(user))


class Me(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"id": request.user.id, "email": request.user.email})


class Analyze(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        t0 = time.perf_counter()
        f = request.FILES.get("image")
        if not f:
            return Response({"error": "Attach an image in the 'image' field."}, status=400)
        ops = set(request.data.getlist("operations")) or {"detect", "prompt"}
        style = request.data.get("style", "detailed")
        style = style if style in prompts.STYLES else "detailed"
        try:
            v = validate_image(f.read(settings.MAX_UPLOAD_MB * 1024 * 1024 + 1), settings.MAX_UPLOAD_MB)
        except InvalidImage as e:
            _event(request, "analyze", False, 0)
            return Response({"error": str(e)}, status=400)

        result = {"file": {"sha256": v.sha256, "mime": v.mime, "width": v.width, "height": v.height},
                  "timings_ms": {}}
        det = prov = None
        if "detect" in ops:
            t = time.perf_counter()
            det = detector.analyze(v.image)
            prov = provenance.inspect(v.raw, v.image)
            result["detection"], result["provenance"] = det, prov
            result["verdict"] = build_verdict(det, prov)
            result["timings_ms"]["detection"] = int((time.perf_counter() - t) * 1000)

        attrs = final = model_id = None
        if "prompt" in ops:
            t = time.perf_counter()
            try:
                attrs, model_id = mistral.describe_image(v.raw, v.mime)
                final = prompts.compose(attrs, style)
                result["prompt"] = {"attributes": attrs, "text": final, "style": style, "model": model_id}
            except mistral.MistralError as e:
                result["prompt_error"] = str(e)  # safe error; user can retry, nothing is fabricated
            result["timings_ms"]["prompt"] = int((time.perf_counter() - t) * 1000)

        total = int((time.perf_counter() - t0) * 1000)
        result["timings_ms"]["total"] = total
        _event(request, "analyze", "prompt_error" not in result, total)

        if request.user.is_authenticated:  # original bytes are discarded; only results are stored
            rec = ImageAnalysis.objects.create(
                user=request.user, file_hash=v.sha256, mime_type=v.mime,
                detector_score=det["score"] if det else None, detector_label=det["label"] if det else "",
                provenance_status=prov["status"] if prov else "", model_version=det["model_version"] if det else "",
                latency_ms=total, verdict={"detection": det, "provenance": prov, "verdict": result.get("verdict")})
            if attrs:
                GeneratedPrompt.objects.create(analysis=rec, visual_description_json=attrs, final_prompt=final,
                                               target_style=style, model_id=model_id)
            result["id"] = rec.id
        return Response(result)


class Compose(APIView):
    """Re-compose a prompt from attributes with a style/format; optional Codestral polish (text-only)."""
    parser_classes = [JSONParser]

    def post(self, request):
        try:
            attrs = prompts.normalize(request.data.get("attributes") or {})
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        style = request.data.get("style", "detailed")
        fmt = request.data.get("format", "plain")
        style = style if style in prompts.STYLES else "detailed"
        fmt = fmt if fmt in prompts.FORMATS else "plain"
        text = prompts.compose(attrs, style, fmt)
        out = {"text": text, "style": style, "format": fmt, "polished": False}
        if request.data.get("polish"):
            try:
                out["text"], out["model"] = mistral.polish_prompt(text, style)
                out["polished"] = True
            except mistral.MistralError as e:
                out["polish_error"] = str(e)
        aid = request.data.get("analysis_id")
        if aid and request.user.is_authenticated:
            GeneratedPrompt.objects.filter(analysis_id=aid, analysis__user=request.user).update(
                final_prompt=out["text"], target_style=style)
        return Response(out)


def _serialize(rec):
    p = getattr(rec, "prompt", None)
    return {"id": rec.id, "created_at": rec.created_at, "file_hash": rec.file_hash[:12], "mime_type": rec.mime_type,
            "detector_label": rec.detector_label, "detector_score": rec.detector_score,
            "provenance_status": rec.provenance_status, "latency_ms": rec.latency_ms,
            "verdict": (rec.verdict or {}).get("verdict"),
            "prompt": {"text": p.final_prompt, "style": p.target_style, "attributes": p.visual_description_json,
                       "model": p.model_id} if p else None}


class History(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ImageAnalysis.objects.filter(user=request.user).select_related("prompt")[:100]
        return Response([_serialize(r) for r in qs])


class HistoryItem(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        return Response(_serialize(get_object_or_404(ImageAnalysis, pk=pk, user=request.user)))

    def delete(self, request, pk):
        get_object_or_404(ImageAnalysis, pk=pk, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class Report(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        rec = get_object_or_404(ImageAnalysis, pk=pk, user=request.user)
        d = _serialize(rec)
        v = d["verdict"] or {}
        lines = [f"# PromptXpert AI report #{rec.id}", f"Generated: {rec.created_at:%Y-%m-%d %H:%M UTC}",
                 f"File SHA-256: `{rec.file_hash}`  |  Type: {rec.mime_type}", "",
                 "## Authenticity signals", f"Overall: **{v.get('overall', 'not assessed')}**"]
        for e in v.get("evidence", []):
            lines.append(f"- {e['signal']}: {e['state']} - {e['detail']}")
        if v.get("disclaimer"):
            lines += ["", f"_{v['disclaimer']}_"]
        if d["prompt"]:
            lines += ["", "## Reconstructed prompt (approximate, not the original)", d["prompt"]["text"],
                      "", f"Style: {d['prompt']['style']} | Model: {d['prompt']['model']}"]
        lines += ["", f"Model version: {rec.model_version} | Latency: {rec.latency_ms} ms"]
        resp = HttpResponse("\n".join(lines), content_type="text/markdown; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="promptxpert-report-{rec.id}.md"'
        return resp
