"""Run: python manage.py test   (service tests also run without Django: python -m unittest core.tests)"""
import io
import unittest

from PIL import Image

from core.services import detector, prompts, provenance
from core.services.validation import InvalidImage, validate_image


def png_bytes(size=(128, 128), color=(120, 80, 200)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


class ValidationTests(unittest.TestCase):
    def test_accepts_png(self):
        v = validate_image(png_bytes())
        self.assertEqual(v.mime, "image/png")

    def test_rejects_garbage_and_wrong_signature(self):
        with self.assertRaises(InvalidImage):
            validate_image(b"not an image at all")
        with self.assertRaises(InvalidImage):
            validate_image(b"\xff\xd8\xff" + b"\x00" * 100)

    def test_rejects_tiny_and_empty(self):
        with self.assertRaises(InvalidImage):
            validate_image(png_bytes((8, 8)))
        with self.assertRaises(InvalidImage):
            validate_image(b"")


class DetectorTests(unittest.TestCase):
    def test_returns_valid_structure_and_bounded_score(self):
        out = detector.analyze(validate_image(png_bytes()).image)
        self.assertIn(out["label"], {"ai-like", "real-like", "inconclusive"})
        self.assertTrue(0 <= out["score"] <= 1)
        self.assertIn("confidence_note", out)


class ProvenanceTests(unittest.TestCase):
    def test_missing_metadata_is_not_ai(self):
        v = validate_image(png_bytes())
        out = provenance.inspect(v.raw, v.image)
        self.assertEqual(out["status"], "no_metadata")
        self.assertEqual(out["generator_flags"], [])

    def test_png_generation_parameters_flagged(self):
        from PIL import PngImagePlugin
        info = PngImagePlugin.PngInfo()
        info.add_text("parameters", "a cat, Steps: 20, Sampler: Euler, Model: stable diffusion")
        buf = io.BytesIO()
        Image.new("RGB", (128, 128)).save(buf, "PNG", pnginfo=info)
        v = validate_image(buf.getvalue())
        out = provenance.inspect(v.raw, v.image)
        self.assertEqual(out["status"], "generator_metadata")


class PromptTests(unittest.TestCase):
    ATTRS = {"subject": "a red fox", "environment": "snowy forest", "composition": "centered",
             "lighting": "soft dawn light", "visual_style": "photorealistic", "mood": "calm",
             "color_palette": ["red", "white"], "camera_perspective": "eye level"}

    def test_normalize_requires_fields(self):
        with self.assertRaises(ValueError):
            prompts.normalize({"subject": "x"})
        self.assertIn("subject", prompts.normalize(self.ATTRS))

    def test_all_styles_and_formats(self):
        a = prompts.normalize(self.ATTRS)
        for s in prompts.STYLES:
            self.assertIn("fox", prompts.compose(a, s))
        self.assertIn("--ar", prompts.compose(a, "detailed", "midjourney"))
        self.assertIn("Negative prompt", prompts.compose(a, "detailed", "stable-diffusion"))


if __name__ == "__main__":
    unittest.main()
