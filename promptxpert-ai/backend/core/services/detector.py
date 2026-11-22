"""AI-likelihood estimation.

Two modes, always reported honestly in `method`:
  * "efficientnet-b0"  - trained weights found at ml/weights/efficientnet_b0.pt (see ml/train.py)
  * "heuristic-fallback" - lightweight signal-processing heuristics (no trained weights).
                           This is NOT the project classifier. It is deliberately low-confidence
                           and mostly returns "inconclusive". It exists so the app works on
                           free hosting (512 MB RAM, no PyTorch).
The score estimates similarity to the training distribution. It never proves origin.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

WEIGHTS = Path(__file__).resolve().parents[2] / "ml" / "weights"
_model_cache = {}


def _label(score: float, low: float, high: float) -> str:
    if score >= high:
        return "ai-like"
    if score <= low:
        return "real-like"
    return "inconclusive"


def _try_load_model():
    if "m" in _model_cache:
        return _model_cache["m"]
    path, meta_path = WEIGHTS / "efficientnet_b0.pt", WEIGHTS / "meta.json"
    result = None
    if path.exists():
        try:
            import torch
            from torchvision import models
            net = models.efficientnet_b0()
            net.classifier[1] = torch.nn.Linear(net.classifier[1].in_features, 1)
            net.load_state_dict(torch.load(path, map_location="cpu"))
            net.eval()
            meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
            result = (net, meta)
        except Exception:  # torch missing or bad weights -> fall back, never crash
            result = None
    _model_cache["m"] = result
    return result


def _run_trained(net, meta, img: Image.Image) -> dict:
    import torch
    x = img.convert("RGB").resize((224, 224), Image.BICUBIC)
    arr = (np.asarray(x, dtype=np.float32) / 255.0 - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    t = torch.from_numpy(arr.transpose(2, 0, 1)).float().unsqueeze(0)
    with torch.no_grad():
        score = float(torch.sigmoid(net(t))[0, 0])
    low, high = meta.get("band_low", 0.35), meta.get("band_high", 0.65)
    return {"score": round(score, 4), "label": _label(score, low, high), "method": "efficientnet-b0",
            "model_version": meta.get("version", "efficientnet-b0-unversioned"),
            "band": [low, high], "signals": []}


def _heuristics(img: Image.Image) -> dict:
    g = img.convert("L")
    g.thumbnail((512, 512))
    a = np.asarray(g, dtype=np.float32)
    resid = a - np.asarray(g.filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32)
    noise_std = float(resid.std())

    spec = np.abs(np.fft.fftshift(np.fft.fft2(a - a.mean()))) ** 2
    h, w = spec.shape
    yy, xx = np.ogrid[:h, :w]
    r = np.hypot((yy - h / 2) / (h / 2), (xx - w / 2) / (w / 2))
    hf_ratio = float(spec[r > 0.5].sum() / (spec.sum() + 1e-9))

    bs = 32
    hb, wb = (resid.shape[0] // bs) * bs, (resid.shape[1] // bs) * bs
    blocks = resid[:hb, :wb].reshape(hb // bs, bs, wb // bs, bs).std(axis=(1, 3))
    uniformity = float(blocks.std() / (blocks.mean() + 1e-6))  # real sensor noise is uneven

    # Weak, hand-set weights. Output is intentionally compressed toward 0.5.
    z = 0.9 * (1.6 - noise_std) / 1.6 + 0.6 * (0.55 - uniformity) + 0.4 * (0.002 - hf_ratio) * 200
    score = float(np.clip(0.5 + 0.18 * math.tanh(z), 0.3, 0.7))
    sig = [
        {"name": "Noise level", "value": round(noise_std, 3),
         "note": "Very smooth noise can be common in synthetic images, but also in denoised or compressed photos."},
        {"name": "Noise uniformity", "value": round(uniformity, 3),
         "note": "Camera sensor noise tends to vary across a frame; some generators produce more even texture."},
        {"name": "High-frequency energy", "value": round(hf_ratio, 5),
         "note": "Resizing and compression change this strongly, so it is a weak signal."},
    ]
    return {"score": round(score, 4), "label": _label(score, 0.40, 0.60), "method": "heuristic-fallback",
            "model_version": "heuristic-v1", "band": [0.40, 0.60], "signals": sig}


def analyze(img: Image.Image) -> dict:
    loaded = _try_load_model()
    out = _run_trained(*loaded, img) if loaded else _heuristics(img)
    s = out["score"]
    out["confidence_note"] = (
        "Insufficient evidence for a call. Treat this as unknown." if out["label"] == "inconclusive"
        else f"Estimated AI-likelihood {s:.0%}. This is a statistical estimate, not proof of origin.")
    if out["method"] == "heuristic-fallback":
        out["confidence_note"] += " Trained EfficientNet-B0 weights are not installed, so only basic heuristics ran."
    return out
