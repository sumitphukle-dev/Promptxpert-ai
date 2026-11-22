"""Turns the structured visual description into editable prompts."""
FIELDS = ["subject", "secondary_objects", "environment", "composition", "camera_perspective",
          "lighting", "color_palette", "mood", "visual_style", "texture_detail", "uncertain_observations"]
LIST_FIELDS = {"secondary_objects", "color_palette", "uncertain_observations"}
REQUIRED = ["subject", "environment", "composition", "lighting", "visual_style"]
STYLES = ("concise", "detailed", "cinematic", "illustrative")
FORMATS = ("plain", "midjourney", "stable-diffusion")


def _s(v):
    return ", ".join(str(x) for x in v) if isinstance(v, list) else str(v or "").strip()


def normalize(raw: dict) -> dict:
    out = {}
    for f in FIELDS:
        v = raw.get(f, [] if f in LIST_FIELDS else "")
        if f in LIST_FIELDS and not isinstance(v, list):
            v = [v] if v else []
        out[f] = v
    missing = [f for f in REQUIRED if not _s(out[f])]
    if missing:
        raise ValueError("Missing fields: " + ", ".join(missing))
    return out


def compose(attrs: dict, style: str = "detailed", fmt: str = "plain") -> str:
    a = {k: _s(attrs.get(k)) for k in FIELDS}
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
        text += " --ar 3:2 --style raw"
    elif fmt == "stable-diffusion":
        text += ", highly detailed, sharp focus\nNegative prompt: blurry, low quality, watermark, extra fingers, distorted"
    return text
