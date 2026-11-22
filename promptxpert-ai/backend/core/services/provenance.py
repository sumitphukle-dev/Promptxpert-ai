"""Metadata + C2PA inspection. Missing metadata is never treated as evidence of AI generation."""
from PIL import ExifTags, Image

GENERATOR_HINTS = ("midjourney", "dall-e", "dalle", "stable diffusion", "firefly", "comfyui",
                   "automatic1111", "novelai", "imagen", "leonardo", "ideogram", "flux")
EXIF_KEYS = {"Make", "Model", "Software", "DateTime", "Artist", "Copyright", "LensModel"}
PNG_GENERATOR_KEYS = ("parameters", "prompt", "workflow", "sd-metadata", "Comment")


def _c2pa(raw: bytes) -> dict:
    """Detects presence of a JUMBF/C2PA manifest. Does NOT cryptographically validate it."""
    if b"c2pa" in raw[:2_000_000] or b"jumb" in raw[:2_000_000]:
        return {"status": "present_unverified",
                "message": "A Content Credentials (C2PA) manifest appears to be embedded. "
                           "Signature validation was not performed by this server."}
    return {"status": "absent", "message": "No provenance credential detected. This does not indicate how the image was made."}


def inspect(raw: bytes, img: Image.Image) -> dict:
    exif, flags = {}, []
    try:
        for tag_id, val in img.getexif().items():
            name = ExifTags.TAGS.get(tag_id, str(tag_id))
            if name in EXIF_KEYS:
                exif[name] = str(val)[:120]
    except Exception:
        pass
    text_meta = {k: str(v)[:200] for k, v in (img.info or {}).items()
                 if isinstance(k, str) and k in PNG_GENERATOR_KEYS and isinstance(v, (str, bytes))}
    haystack = " ".join(list(exif.values()) + list(text_meta.values())).lower()
    for hint in GENERATOR_HINTS:
        if hint in haystack:
            flags.append(f"Metadata mentions '{hint}'.")
    if "parameters" in text_meta or "workflow" in text_meta:
        flags.append("PNG contains generation parameters typical of local image-generation tools.")
    c2pa = _c2pa(raw)
    status = "generator_metadata" if flags else c2pa["status"]
    if not flags and c2pa["status"] == "absent" and not exif:
        status = "no_metadata"
    return {"status": status, "c2pa": c2pa, "exif": exif, "generator_flags": flags,
            "summary": {
                "generator_metadata": "Embedded metadata points to an image-generation tool.",
                "present_unverified": "Content Credentials found but not validated.",
                "absent": "Metadata present, but no provenance credential detected.",
                "no_metadata": "No provenance credential detected. Metadata is often removed when images are shared.",
            }.get(status, "Metadata unreadable.")}
