"""Turns the structured visual description into editable prompts for several generators."""
FIELDS = ["subject", "secondary_objects", "environment", "composition", "camera_perspective",
          "lighting", "color_palette", "mood", "visual_style", "texture_detail", "uncertain_observations"]
LIST_FIELDS = {"secondary_objects", "color_palette", "uncertain_observations"}
EXTRA = ["alt_text", "negative_prompt", "art_medium", "lens_and_focus"]  # optional plain strings
EXTRA_LISTS = ["keywords", "style_tags"]                                   # optional short-tag lists
REQUIRED = ["subject", "environment", "composition", "lighting", "visual_style"]
STYLES = ("concise", "detailed", "cinematic", "illustrative")
FORMATS = ("plain", "midjourney", "stable-diffusion", "flux", "dalle3")
DEFAULT_NEGATIVE = "blurry, low quality, watermark, text, extra fingers, distorted anatomy, jpeg artifacts"


def _s(v):
    return ", ".join(str(x) for x in v) if isinstance(v, list) else str(v or "").strip()


def normalize(raw: dict) -> dict:
    out = {}
    for f in FIELDS:
        v = raw.get(f, [] if f in LIST_FIELDS else "")
        if f in LIST_FIELDS and not isinstance(v, list):
            v = [v] if v else []
        out[f] = v
    for f in EXTRA:
        out[f] = _s(raw.get(f))[:400]
    for f in EXTRA_LISTS:
        v = raw.get(f) or []
        v = v if isinstance(v, list) else [v]
        out[f] = [str(x).strip()[:60] for x in v if str(x).strip()][:20]
    missing = [f for f in REQUIRED if not _s(out[f])]
    if missing:
        raise ValueError("Missing fields: " + ", ".join(missing))
    return out


def _sentences(a):
    """Natural-language form for generators that prefer prose (Flux, DALL-E 3)."""
    s = [a["subject"] + (f" with {a['secondary_objects']}" if a["secondary_objects"] else "")]
    if a["environment"]:
        s.append(f"The scene is set in {a['environment']}")
    if a["composition"] or a["camera_perspective"]:
        s.append("The composition is " + ", ".join(x for x in (a["composition"], a["camera_perspective"]) if x))
    if a["lighting"]:
        s.append(f"The lighting is {a['lighting']}")
    if a["color_palette"] or a["mood"]:
        s.append("The palette is " + a["color_palette"] + (f" with a {a['mood']} mood" if a["mood"] else ""))
    if a["visual_style"] or a["texture_detail"]:
        s.append("Style: " + ", ".join(x for x in (a["visual_style"], a["texture_detail"]) if x))
    return ". ".join(x.strip(" .,") for x in s if x.strip(" .,")) + "."


def compose(attrs: dict, style: str = "detailed", fmt: str = "plain", ar: str = "3:2") -> str:
    a = {k: _s(attrs.get(k)) for k in FIELDS + EXTRA + EXTRA_LISTS}
    if fmt in ("flux", "dalle3"):
        text = _sentences(a)
        return text + (" No text or watermarks." if fmt == "dalle3" else "")
    if style == "concise":
        parts = [a["subject"], a["environment"], a["lighting"], a["visual_style"]]
    elif style == "cinematic":
        parts = [f"Cinematic still of {a['subject']}", a["environment"], a["camera_perspective"] + " shot",
                 a["lighting"] + ", dramatic contrast", a["color_palette"] + " colour grade", a["mood"] + " atmosphere",
                 "shallow depth of field, anamorphic lens, film grain"]
    elif style == "illustrative":
        parts = [f"Digital illustration of {a['subject']}", a["secondary_objects"], a["environment"],
                 a["composition"], a["color_palette"] + " palette", a["mood"] + " mood",
                 a["visual_style"] + ", clean linework, painterly shading"]
    else:
        parts = [a["subject"], a["secondary_objects"], a["environment"], a["composition"], a["camera_perspective"],
                 a["lighting"], a["color_palette"] + " colour palette", a["mood"] + " mood", a["visual_style"],
                 a["texture_detail"]]
    text = ", ".join(p.strip(" ,") for p in parts if p and p.strip(" ,") not in ("shot", "colour palette", "mood"))
    if fmt == "midjourney":
        text += f" --ar {ar} --style raw --stylize 250"
    elif fmt == "stable-diffusion":
        text += ", highly detailed, sharp focus\nNegative prompt: " + (a["negative_prompt"] or DEFAULT_NEGATIVE)
    return text
