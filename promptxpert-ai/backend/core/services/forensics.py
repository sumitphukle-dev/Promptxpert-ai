"""Visual forensics + utility analysis. Pure Pillow/NumPy (free-tier friendly).
Heatmaps are *aids for human inspection*, not proof. ELA in particular is easily fooled by recompression."""
import base64
import io

import numpy as np
from PIL import Image, ImageChops, ImageFilter

_STOPS = np.array([[8, 10, 18], [80, 60, 200], [255, 90, 143], [255, 198, 92], [255, 255, 255]], dtype=np.float32)


def _fit(img, side=640):
    im = img.convert("RGB")
    im.thumbnail((side, side))
    return im


def _colorize(norm):
    x = np.clip(norm, 0, 1) * (len(_STOPS) - 1)
    i = np.minimum(x.astype(int), len(_STOPS) - 2)
    f = (x - i)[..., None]
    return Image.fromarray((_STOPS[i] * (1 - f) + _STOPS[i + 1] * f).astype(np.uint8))


def _b64(img):
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def ela(img, quality=90):
    im = _fit(img)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality)
    buf.seek(0)
    diff = np.asarray(ImageChops.difference(im, Image.open(buf).convert("RGB")), dtype=np.float32).max(axis=2)
    scale = max(float(np.percentile(diff, 99.5)), 1.0)
    return _colorize(diff / scale), {"mean": round(float(diff.mean()), 3), "p99": round(float(np.percentile(diff, 99)), 3)}


def noise_map(img):
    g = _fit(img).convert("L")
    a = np.asarray(g, dtype=np.float32)
    resid = np.abs(a - np.asarray(g.filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32))
    loc = Image.fromarray(np.clip(resid * 8, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
    return _colorize(np.asarray(loc, dtype=np.float32) / 255.0), {"mean": round(float(resid.mean()), 3)}


def spectrum_map(img):
    a = np.asarray(_fit(img, 512).convert("L"), dtype=np.float32)
    a = (a - a.mean()) * np.outer(np.hanning(a.shape[0]), np.hanning(a.shape[1]))
    s = np.log1p(np.abs(np.fft.fftshift(np.fft.fft2(a))))
    h, w = s.shape
    yy, xx = np.ogrid[:h, :w]
    r = np.hypot((yy - h / 2) / (h / 2), (xx - w / 2) / (w / 2))
    hf = s[r > 0.35]
    peak = float(hf.max() / (np.median(hf) + 1e-9))
    return _colorize((s - s.min()) / (s.max() - s.min() + 1e-9)), {"peak_ratio": round(peak, 2)}


def maps(img):
    out = {}
    for key, fn, note in (
        ("ela", ela, "Brighter areas recompress differently from the rest. Edited or pasted regions can stand out, but so can sharp edges and text."),
        ("noise", noise_map, "Shows where fine-grain noise is strong. Real sensors tend to give uneven, textured noise; some generators look unusually smooth or uniform."),
        ("spectrum", spectrum_map, "Frequency view. Regular bright dots or grids away from the centre can hint at upsampling patterns, but resizing also causes them."),
    ):
        m, stats = fn(img)
        out[key] = {"image": _b64(m), "stats": stats, "note": note}
    return out


def robustness(img, analyze_fn):
    """Does the classifier's answer survive resizing, recompression and blur? (synopsis 4.8)"""
    im = img.convert("RGB")
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=60)
    buf.seek(0)
    jpg = Image.open(buf)
    jpg.load()
    variants = [("Original", im),
                ("Resized 50%", im.resize((max(64, im.width // 2), max(64, im.height // 2)), Image.BICUBIC)),
                ("JPEG quality 60", jpg),
                ("Slight blur", im.filter(ImageFilter.GaussianBlur(1.0)))]
    rows = [{"variant": n, "score": analyze_fn(v)["score"]} for n, v in variants]
    scores = [r["score"] for r in rows]
    spread = round(max(scores) - min(scores), 4)
    return {"variants": rows, "spread": spread, "stable": spread < 0.1,
            "note": "Stable: the estimate barely moves under common edits." if spread < 0.1
            else "Unstable: the estimate shifts noticeably under ordinary edits, so treat it with extra caution."}


def dhash(img, size=8):
    a = np.asarray(img.convert("L").resize((size + 1, size), Image.LANCZOS), dtype=np.int16)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return "%016x" % int("".join("1" if b else "0" for b in bits), 2)


def hamming(a, b):
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def palette(img, k=5):
    im = img.convert("RGB")
    im.thumbnail((80, 80))
    px = np.asarray(im, dtype=np.float32).reshape(-1, 3)
    k = min(k, len(px))
    cent = px[np.random.default_rng(0).choice(len(px), k, replace=False)].copy()
    for _ in range(12):
        lab = ((px[:, None, :] - cent[None]) ** 2).sum(2).argmin(1)
        for i in range(k):
            m = lab == i
            if m.any():
                cent[i] = px[m].mean(0)
    share = np.bincount(lab, minlength=k) / len(px)
    return [{"hex": "#%02x%02x%02x" % tuple(int(c) for c in cent[i]), "share": round(float(share[i]), 3)}
            for i in np.argsort(-share) if share[i] > 0]


_EXIF_SKIP = {"MakerNote", "UserComment", "PrintImageMatching", "ComponentsConfiguration", "ExifVersion", "FlashPixVersion"}


def exif_dump(img, limit=40):
    from PIL import ExifTags
    out = {}
    try:
        ex = img.getexif()
        tags = dict(ex)
        try:
            tags.update(ex.get_ifd(0x8769))
        except Exception:
            pass
        for tid, val in tags.items():
            name = ExifTags.TAGS.get(tid, str(tid))
            if name in _EXIF_SKIP or isinstance(val, (bytes, bytearray, dict)):
                continue
            out[name] = str(val)[:80]
            if len(out) >= limit:
                break
    except Exception:
        pass
    return out


def privacy(img):
    """What a recipient could learn about the photographer from this file's metadata."""
    items = []
    try:
        ex = img.getexif()
        gps = ex.get_ifd(0x8825)
        sub = ex.get_ifd(0x8769)
    except Exception:
        ex, gps, sub = {}, {}, {}
    if gps:
        items.append({"level": "high", "item": "GPS location", "detail": "Coordinates are embedded. Anyone with the file could see where it was taken."})
    for tag, label in ((0xA431, "Camera serial number"), (0xA435, "Lens serial number")):
        if sub and sub.get(tag):
            items.append({"level": "medium", "item": label, "detail": "A unique hardware identifier can link photos to one device."})
    for tag, label in ((0x013B, "Photographer name"), (0xA430, "Camera owner name")):
        v = (ex.get(tag) if ex else None) or (sub.get(tag) if sub else None)
        if v:
            items.append({"level": "medium", "item": label, "detail": f"Name recorded in the file: {str(v)[:60]}"})
    if sub and sub.get(0x9003):
        items.append({"level": "low", "item": "Original capture time", "detail": f"Taken at {str(sub[0x9003])[:30]}"})
    if ex and (ex.get(0x010F) or ex.get(0x0110)):
        items.append({"level": "low", "item": "Device make and model", "detail": f"{ex.get(0x010F, '')} {ex.get(0x0110, '')}".strip()[:80]})
    risk = "high" if any(i["level"] == "high" for i in items) else "medium" if any(i["level"] == "medium" for i in items) else "low" if items else "clean"
    return {"risk": risk, "items": items,
            "advice": "Remove metadata (re-export or screenshot) before sharing publicly." if risk in ("high", "medium")
            else "Little identifying metadata found." if risk == "clean" else "Only minor details are present."}


_RATIOS = [("1:1", 1.0, "1024x1024"), ("5:4", 1.25, "1152x896"), ("4:3", 4 / 3, "1152x896"), ("3:2", 1.5, "1216x832"),
           ("16:9", 16 / 9, "1344x768"), ("21:9", 21 / 9, "1536x640")]


def aspect(w, h):
    """Nearest common aspect ratio plus a matching SDXL-friendly size."""
    import math
    r = max(w, h) / min(w, h)
    name, _, size = min(_RATIOS, key=lambda x: abs(math.log(r / x[1])))
    if h > w:
        name, size = ":".join(reversed(name.split(":"))), "x".join(reversed(size.split("x")))
    return {"ratio": name, "sd_size": size, "orientation": "square" if name == "1:1" else "portrait" if h > w else "landscape"}


def camera_hints(img):
    """Photographic settings recorded in EXIF, phrased as prompt-ready tokens."""
    hints = []
    try:
        ex = img.getexif()
        sub = ex.get_ifd(0x8769)
        make, model = str(ex.get(0x010F, "")).strip(), str(ex.get(0x0110, "")).strip()
        if model:
            hints.append("shot on " + (model if not make or make.lower() in model.lower() else f"{make} {model}"))
        if sub.get(0x920A):
            hints.append(f"{float(sub[0x920A]):.0f}mm lens")
        if sub.get(0x829D):
            hints.append(f"f/{float(sub[0x829D]):.1f} aperture")
        if sub.get(0x829A):
            t = float(sub[0x829A])
            hints.append(f"1/{round(1 / t)}s shutter" if 0 < t < 1 else f"{t:g}s exposure")
        iso = sub.get(0x8827)
        if iso:
            hints.append(f"ISO {iso[0] if isinstance(iso, (tuple, list)) else iso}")
    except Exception:
        pass
    return hints
