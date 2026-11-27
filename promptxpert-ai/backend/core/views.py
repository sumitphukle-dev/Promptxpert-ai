import json
import logging
import os
import re
import secrets
import time
from collections import Counter
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import Avg, Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import GeneratedPrompt, ImageAnalysis, SystemEvent
from .services import detector, forensics, groq, prompts, provenance
from .services.validation import InvalidImage, validate_image

log = logging.getLogger(__name__)
User = get_user_model()
ALL_OPS = {"detect", "prompt", "forensics"}


def _tokens(user):
    r = RefreshToken.for_user(user)
    return {"access": str(r.access_token), "refresh": str(r), "user": {"id": user.id, "email": user.email}}


def _event(request, kind, ok, ms):
    """Telemetry must never break a request."""
    try:
        SystemEvent.objects.create(user=request.user if request.user.is_authenticated else None,
                                   event_type=kind, status="ok" if ok else "error", latency_ms=ms)
    except Exception:
        log.exception("could not record system event")


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
    return {"overall": overall, "evidence": notes,
            "disclaimer": "An estimate from automated signals. It cannot prove whether an image is real or AI-generated."}


class Health(APIView):
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        loaded = detector._try_load_model() is not None
        model = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
        return Response({"ok": True, "detector": "efficientnet-b0" if loaded else "heuristic-fallback",
                         "prompt_ready": bool(os.getenv("GROQ_API_KEY")),
                         "text_model": model,
                         "vision_model": model,
                         "max_upload_mb": settings.MAX_UPLOAD_MB})


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
        user = User.objects.create_user(username=email, email=email, password=password)
        return Response(_tokens(user), status=201)


class Login(APIView):
    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        user = authenticate(username=email, password=request.data.get("password") or "")
        if not user:
            return Response({"error": "Email or password is incorrect."}, status=401)
        return Response(_tokens(user))


class Me(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"id": request.user.id, "email": request.user.email})


def _clean_name(name):
    return re.sub(r"[^\w .\-()]", "", os.path.basename(name or ""))[:120]


class Analyze(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        t0 = time.perf_counter()
        f = request.FILES.get("image")
        if not f:
            return Response({"error": "Attach an image in the 'image' field."}, status=400)
        ops = (set(request.data.getlist("operations")) & ALL_OPS) or {"detect", "prompt", "forensics"}
        style = request.data.get("style", "detailed")
        style = style if style in prompts.STYLES else "detailed"
        try:
            v = validate_image(f.read(settings.MAX_UPLOAD_MB * 1024 * 1024 + 1), settings.MAX_UPLOAD_MB)
        except InvalidImage as e:
            _event(request, "analyze", False, 0)
            return Response({"error": str(e)}, status=400)

        result = {"file": {"sha256": v.sha256, "mime": v.mime, "width": v.width, "height": v.height,
                           "bytes": len(v.raw), "name": _clean_name(f.name)}, "timings_ms": {}}
        det = prov = rob = None
        t = time.perf_counter()
        # cheap, always-on utilities
        result["aspect"] = forensics.aspect(v.width, v.height)
        result["camera"] = forensics.camera_hints(v.image)
        result["palette"] = forensics.palette(v.image)
        result["privacy"] = forensics.privacy(v.image)
        dh = forensics.dhash(v.image)

        if "detect" in ops:
            det = detector.analyze(v.image)
            prov = provenance.inspect(v.raw, v.image)
            prov["exif_all"] = forensics.exif_dump(v.image)
            rob = forensics.robustness(v.image, detector.analyze)
            result.update(detection=det, provenance=prov, robustness=rob, verdict=build_verdict(det, prov))
            result["timings_ms"]["detection"] = int((time.perf_counter() - t) * 1000)

        if "forensics" in ops:
            t = time.perf_counter()
            try:
                result["forensics"] = forensics.maps(v.image)
            except Exception:
                log.exception("forensic maps failed")
                result["forensics_error"] = "Could not render the forensic maps for this image."
            result["timings_ms"]["forensics"] = int((time.perf_counter() - t) * 1000)

        attrs = final = model_id = None
        if "prompt" in ops:
            t = time.perf_counter()
            try:
                attrs, model_id = groq.describe_image(v.raw, v.mime)
                final = prompts.compose(attrs, style)
                result["prompt"] = {"attributes": attrs, "text": final, "style": style, "model": model_id}
            except groq.GroqError as e:
                result["prompt_error"] = str(e)
            result["timings_ms"]["prompt"] = int((time.perf_counter() - t) * 1000)

        total = int((time.perf_counter() - t0) * 1000)
        result["timings_ms"]["total"] = total
        _event(request, "analyze", "prompt_error" not in result, total)

        # similar earlier analyses (perceptual hash)
        result["similar"], result["saved"] = [], False
        if request.user.is_authenticated:
            try:
                for r in ImageAnalysis.objects.filter(user=request.user).exclude(dhash="")[:300]:
                    d = forensics.hamming(dh, r.dhash)
                    if d <= 10:
                        result["similar"].append({"id": r.id, "title": r.title or r.original_name or f"Analysis #{r.id}",
                                                  "distance": d, "exact": r.file_hash == v.sha256})
                result["similar"] = sorted(result["similar"], key=lambda x: x["distance"])[:3]
                report = {"detection": det, "provenance": prov, "verdict": result.get("verdict"), "privacy": result["privacy"],
                          "robustness": rob, "alt_text": (attrs or {}).get("alt_text", "")}
                rec = ImageAnalysis.objects.create(
                    user=request.user, file_hash=v.sha256, mime_type=v.mime, original_name=result["file"]["name"],
                    title=os.path.splitext(result["file"]["name"])[0][:120], dhash=dh, palette=result["palette"],
                    detector_score=det["score"] if det else None, detector_label=det["label"] if det else "",
                    provenance_status=prov["status"] if prov else "", model_version=det["model_version"] if det else "",
                    latency_ms=total, verdict=report)
                if attrs:
                    GeneratedPrompt.objects.create(analysis=rec, visual_description_json=attrs, final_prompt=final,
                                                   target_style=style, model_id=model_id)
                result["id"], result["saved"] = rec.id, True
            except Exception:
                log.exception("could not save analysis")  # the analysis itself still succeeds
        return Response(result)


class Compose(APIView):
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
        ar = str(request.data.get("ar") or "3:2")
        ar = ar if re.fullmatch(r"\d{1,2}:\d{1,2}", ar) else "3:2"
        text = prompts.compose(attrs, style, fmt, ar)
        out = {"text": text, "style": style, "format": fmt, "polished": False}
        if request.data.get("polish"):
            try:
                out["text"], out["model"] = groq.polish_prompt(text, style)
                out["polished"] = True
            except groq.GroqError as e:
                out["polish_error"] = str(e)
        aid = request.data.get("analysis_id")
        if aid and request.user.is_authenticated:
            GeneratedPrompt.objects.filter(analysis_id=aid, analysis__user=request.user).update(
                final_prompt=out["text"], target_style=style)
        return Response(out)


class Transform(APIView):
    """AI edits of a prompt: expand, shorten, polish, reimagine in a style, translate, or write a negative prompt."""
    parser_classes = [JSONParser]

    def post(self, request):
        text = str(request.data.get("text") or "").strip()
        mode = request.data.get("mode")
        arg = re.sub(r"[^\w \-]", "", str(request.data.get("arg") or ""))[:40].strip()
        if not text or len(text) > 2500:
            return Response({"error": "Provide prompt text up to 2500 characters."}, status=400)
        if mode not in groq.TRANSFORMS:
            return Response({"error": "Unknown mode."}, status=400)
        if mode in ("reimagine", "translate") and not arg:
            return Response({"error": "This mode needs a style or language."}, status=400)
        try:
            out, model = groq.transform(text, mode, arg)
        except groq.GroqError as e:
            return Response({"error": str(e)}, status=503)
        return Response({"text": out, "mode": mode, "model": model})


class Compare(APIView):
    """Side-by-side comparison of two images: authenticity estimates, visual similarity, palettes."""
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        fa, fb = request.FILES.get("a"), request.FILES.get("b")
        if not (fa and fb):
            return Response({"error": "Attach two images in the 'a' and 'b' fields."}, status=400)
        try:
            lim = settings.MAX_UPLOAD_MB
            va, vb = (validate_image(f.read(lim * 1024 * 1024 + 1), lim) for f in (fa, fb))
        except InvalidImage as e:
            return Response({"error": str(e)}, status=400)

        def side(vi, f):
            det = detector.analyze(vi.image)
            return {"name": _clean_name(f.name), "width": vi.width, "height": vi.height, "bytes": len(vi.raw),
                    "detection": det, "palette": forensics.palette(vi.image), "aspect": forensics.aspect(vi.width, vi.height),
                    "privacy_risk": forensics.privacy(vi.image)["risk"]}
        a, b = side(va, fa), side(vb, fb)
        dist = forensics.hamming(forensics.dhash(va.image), forensics.dhash(vb.image))
        return Response({"a": a, "b": b, "hash_distance": dist, "similarity": round(100 * (1 - dist / 64)),
                         "identical": va.sha256 == vb.sha256,
                         "score_gap": round(abs(a["detection"]["score"] - b["detection"]["score"]), 4)})


class Variations(APIView):
    parser_classes = [JSONParser]

    def post(self, request):
        try:
            attrs = prompts.normalize(request.data.get("attributes") or {})
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        base = prompts.compose(attrs, "detailed")
        try:
            items, model = groq.variations(base, 3)
            return Response({"variations": items, "model": model, "source": "ai"})
        except groq.GroqError as e:
            fallback = [prompts.compose(attrs, s) for s in ("concise", "cinematic", "illustrative")]
            return Response({"variations": fallback, "source": "templates", "note": str(e)})


def _serialize(rec):
    p = getattr(rec, "prompt", None)
    rep = rec.verdict or {}
    return {"id": rec.id, "title": rec.title, "original_name": rec.original_name, "starred": rec.starred,
            "tags": rec.tags or [], "share_token": rec.share_token, "palette": rec.palette or [],
            "created_at": rec.created_at, "file_hash": rec.file_hash[:12], "mime_type": rec.mime_type,
            "detector_label": rec.detector_label, "detector_score": rec.detector_score,
            "provenance_status": rec.provenance_status, "latency_ms": rec.latency_ms,
            "verdict": rep.get("verdict"), "privacy_risk": (rep.get("privacy") or {}).get("risk"),
            "prompt": {"text": p.final_prompt, "style": p.target_style, "attributes": p.visual_description_json,
                       "model": p.model_id} if p else None}


def _public(rec):
    rep, p = rec.verdict or {}, getattr(rec, "prompt", None)
    det = rep.get("detection") or {}
    return {"title": rec.title or "Shared analysis", "created_at": rec.created_at, "palette": rec.palette or [],
            "verdict": rep.get("verdict"),
            "detection": {k: det.get(k) for k in ("score", "band", "label", "method", "confidence_note")} if det else None,
            "provenance": (rep.get("provenance") or {}).get("summary"),
            "alt_text": rep.get("alt_text", ""),
            "prompt": {"text": p.final_prompt, "style": p.target_style} if p else None}


class History(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ImageAnalysis.objects.filter(user=request.user).select_related("prompt")[:200]
        return Response([_serialize(r) for r in qs])


class HistoryItem(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        return Response(_serialize(get_object_or_404(ImageAnalysis, pk=pk, user=request.user)))

    def patch(self, request, pk):
        rec, d = get_object_or_404(ImageAnalysis, pk=pk, user=request.user), request.data
        if "title" in d:
            rec.title = str(d["title"])[:120]
        if "starred" in d:
            rec.starred = bool(d["starred"])
        if "prompt_text" in d and hasattr(rec, "prompt"):
            rec.prompt.final_prompt = str(d["prompt_text"])[:4000]
            rec.prompt.save(update_fields=["final_prompt"])
        if isinstance(d.get("tags"), list):
            rec.tags = [str(t).strip()[:24] for t in d["tags"] if str(t).strip()][:8]
        rec.save()
        return Response(_serialize(rec))

    def delete(self, request, pk):
        get_object_or_404(ImageAnalysis, pk=pk, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class Share(APIView):
    """Toggle a public, read-only link. The link exposes results only, never the image."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        rec = get_object_or_404(ImageAnalysis, pk=pk, user=request.user)
        rec.share_token = None if rec.share_token else secrets.token_urlsafe(16)
        rec.save(update_fields=["share_token"])
        return Response({"share_token": rec.share_token})


class Shared(APIView):
    authentication_classes = []

    def get(self, request, token):
        return Response(_public(get_object_or_404(ImageAnalysis.objects.select_related("prompt"), share_token=token)))


class Stats(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ImageAnalysis.objects.filter(user=request.user)
        rows = list(qs.values_list("verdict", "created_at", "starred", "dhash")[:1000])
        by_verdict = Counter(((r[0] or {}).get("verdict") or {}).get("overall", "not-assessed") for r in rows)
        today = timezone.now().date()
        days = {(today - timedelta(days=i)).isoformat(): 0 for i in range(13, -1, -1)}
        for _, created, _, _ in rows:
            k = created.date().isoformat()
            if k in days:
                days[k] += 1
        styles = {r["target_style"]: r["n"] for r in GeneratedPrompt.objects.filter(analysis__user=request.user)
                  .values("target_style").annotate(n=Count("id"))}
        risks = Counter(((r[0] or {}).get("privacy") or {}).get("risk", "clean") for r in rows)
        return Response({"total": len(rows), "starred": sum(1 for r in rows if r[2]),
                         "avg_latency_ms": int(qs.aggregate(a=Avg("latency_ms"))["a"] or 0),
                         "by_verdict": dict(by_verdict), "by_day": [{"day": d, "count": c} for d, c in days.items()],
                         "styles": styles, "privacy_risks": dict(risks)})


class Report(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        rec = get_object_or_404(ImageAnalysis, pk=pk, user=request.user)
        d, rep = _serialize(rec), rec.verdict or {}
        if request.query_params.get("fmt") == "json":
            resp = HttpResponse(json.dumps({**d, "report": rep}, default=str, indent=2), content_type="application/json")
            resp["Content-Disposition"] = f'attachment; filename="promptxpert-report-{rec.id}.json"'
            return resp
        v = d["verdict"] or {}
        lines = [f"# PromptXpert AI report #{rec.id}: {rec.title or rec.original_name}",
                 f"Generated: {rec.created_at:%Y-%m-%d %H:%M UTC}",
                 f"File SHA-256: `{rec.file_hash}`  |  Type: {rec.mime_type}", "",
                 "## Authenticity signals", f"Overall: **{v.get('overall', 'not assessed')}**"]
        for e in v.get("evidence", []):
            lines.append(f"- {e['signal']}: {e['state']} - {e['detail']}")
        rob = rep.get("robustness")
        if rob:
            lines += ["", "## Robustness"] + [f"- {r['variant']}: {r['score']:.2f}" for r in rob["variants"]] + [rob["note"]]
        priv = rep.get("privacy")
        if priv:
            lines += ["", f"## Privacy: {priv['risk']}"] + [f"- [{i['level']}] {i['item']}: {i['detail']}" for i in priv["items"]] + [priv["advice"]]
        if rec.palette:
            lines += ["", "## Palette", ", ".join(c["hex"] for c in rec.palette)]
        if v.get("disclaimer"):
            lines += ["", f"_{v['disclaimer']}_"]
        if d["prompt"]:
            lines += ["", "## Reconstructed prompt (approximate, not the original)", d["prompt"]["text"],
                      "", f"Style: {d['prompt']['style']} | Model: {d['prompt']['model']}"]
            if rep.get("alt_text"):
                lines += ["", f"Alt text: {rep['alt_text']}"]
        lines += ["", f"Model version: {rec.model_version} | Latency: {rec.latency_ms} ms"]
        resp = HttpResponse("\n".join(lines), content_type="text/markdown; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="promptxpert-report-{rec.id}.md"'
        return resp
