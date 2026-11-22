"""Upload validation: size, MIME, file signature, decoding, dimensions."""
import hashlib
import io
from dataclasses import dataclass

from PIL import Image, UnidentifiedImageError

SIGNATURES = {
    "image/jpeg": lambda b: b[:3] == b"\xff\xd8\xff",
    "image/png": lambda b: b[:8] == b"\x89PNG\r\n\x1a\n",
    "image/webp": lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}
FORMAT_TO_MIME = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MIN_SIDE, MAX_SIDE = 64, 12000


class InvalidImage(ValueError):
    pass


@dataclass
class ValidatedImage:
    raw: bytes
    image: Image.Image
    mime: str
    sha256: str
    width: int
    height: int


def validate_image(raw: bytes, max_mb: int = 10) -> ValidatedImage:
    if not raw:
        raise InvalidImage("The file is empty.")
    if len(raw) > max_mb * 1024 * 1024:
        raise InvalidImage(f"The image is larger than {max_mb} MB.")
    mime = next((m for m, check in SIGNATURES.items() if check(raw)), None)
    if not mime:
        raise InvalidImage("Unsupported file type. Upload a JPEG, PNG, or WebP image.")
    try:
        probe = Image.open(io.BytesIO(raw))
        probe.verify()  # integrity check; invalidates the handle
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError):
        raise InvalidImage("The image could not be decoded. It may be corrupted.")
    if FORMAT_TO_MIME.get(img.format) != mime:
        raise InvalidImage("File extension, signature and content do not match.")
    w, h = img.size
    if min(w, h) < MIN_SIDE or max(w, h) > MAX_SIDE:
        raise InvalidImage(f"Image dimensions must be between {MIN_SIDE}px and {MAX_SIDE}px.")
    return ValidatedImage(raw, img, mime, hashlib.sha256(raw).hexdigest(), w, h)
