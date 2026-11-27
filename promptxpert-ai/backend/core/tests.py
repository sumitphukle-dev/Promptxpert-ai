"""Run: python manage.py test   (service tests also run without Django: python -m unittest core.tests)"""
import io
import os
import unittest
from unittest.mock import Mock, patch

from PIL import Image

from core.services import detector, groq, prompts, provenance
from core.services.validation import InvalidImage, validate_image


def png_bytes(size=(128, 128), color=(120, 80, 200)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


class GroqServiceTests(unittest.TestCase):
    def test_chat_uses_groq_endpoint_key_model_and_json_mode(self):
        response = Mock()
        response.status_code = 200
        response.ok = True
        response.json.return_value = {"choices": [{"message": {"content": "ok"}}]}
        messages = [{"role": "user", "content": "test"}]

        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}), \
                patch("core.services.groq.requests.post", return_value=response) as post:
            result = groq._chat("qwen/qwen3.8-27b", messages, json_mode=True)

        self.assertEqual(result, "ok")
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://api.groq.com/openai/v1/chat/completions")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(kwargs["json"]["model"], "qwen/qwen3.8-27b")
        self.assertEqual(kwargs["json"]["response_format"], {"type": "json_object"})

    def test_describe_image_uses_groq_multimodal_payload(self):
        with patch.dict(os.environ, {"GROQ_MODEL": "qwen/qwen3.8-27b"}), \
                patch("core.services.groq._chat", return_value="{}") as chat, \
                patch("core.services.groq.normalize", side_effect=lambda value: value):
            result, model = groq.describe_image(b"x", "image/png")

        self.assertEqual(result, {})
        self.assertEqual(model, "qwen/qwen3.8-27b")
        _, messages = chat.call_args.args
        self.assertTrue(chat.call_args.kwargs["json_mode"])
        image_content = messages[0]["content"][1]
        self.assertEqual(image_content["image_url"], {"url": "data:image/png;base64,eA=="})

    def test_missing_groq_key_is_reported(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(groq.GroqError, "GROQ_API_KEY"):
                groq._key()


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

    def test_heuristic_score_changes_for_distinct_image_signals(self):
        import numpy as np

        flat = Image.new("RGB", (256, 256), (120, 80, 200))
        rng = np.random.default_rng(42)
        noisy = Image.fromarray(rng.integers(0, 256, (256, 256, 3), dtype=np.uint8))

        flat_score = detector._heuristics(flat)["score"]
        noisy_score = detector._heuristics(noisy)["score"]

        self.assertNotEqual(flat_score, noisy_score)
        self.assertGreater(abs(flat_score - noisy_score), 0.05)


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


class ForensicsTests(unittest.TestCase):
    def setUp(self):
        import numpy as np
        rng = np.random.default_rng(1)
        arr = (rng.normal(128, 30, (160, 200, 3))).clip(0, 255).astype("uint8")
        self.img = Image.fromarray(arr)

    def test_maps_return_images(self):
        from core.services import forensics
        m = forensics.maps(self.img)
        for k in ("ela", "noise", "spectrum"):
            self.assertTrue(m[k]["image"].startswith("data:image/jpeg;base64,"))

    def test_robustness_and_hash_and_palette(self):
        from core.services import forensics
        rob = forensics.robustness(self.img, detector.analyze)
        self.assertEqual(len(rob["variants"]), 4)
        h = forensics.dhash(self.img)
        self.assertEqual(forensics.hamming(h, h), 0)
        pal = forensics.palette(self.img)
        self.assertTrue(1 <= len(pal) <= 5)
        self.assertAlmostEqual(sum(c["share"] for c in pal), 1.0, delta=0.02)

    def test_privacy_detects_gps_and_serial(self):
        from core.services import forensics
        ex = Image.Exif()
        ex.get_ifd(0x8825)[1] = "N"
        ex.get_ifd(0x8825)[2] = (19.0, 4.0, 0.0)
        buf = io.BytesIO()
        self.img.save(buf, "JPEG", exif=ex)
        buf.seek(0)
        out = forensics.privacy(Image.open(buf))
        self.assertEqual(out["risk"], "high")
        self.assertEqual(forensics.privacy(self.img)["risk"], "clean")


class StudioTests(unittest.TestCase):
    ATTRS = PromptTests.ATTRS

    def test_new_targets(self):
        a = prompts.normalize({**self.ATTRS, "keywords": ["fox", "snow"], "art_medium": "photograph"})
        self.assertEqual(a["keywords"], ["fox", "snow"])
        self.assertIn("The scene is set in snowy forest", prompts.compose(a, "detailed", "flux"))
        self.assertTrue(prompts.compose(a, "detailed", "dalle3").endswith("No text or watermarks."))
        self.assertIn("--ar 16:9", prompts.compose(a, "detailed", "midjourney", "16:9"))

    def test_aspect(self):
        from core.services import forensics
        self.assertEqual(forensics.aspect(1500, 1000)["ratio"], "3:2")
        self.assertEqual(forensics.aspect(1000, 1500)["ratio"], "2:3")
        self.assertEqual(forensics.aspect(1920, 1080)["sd_size"], "1344x768")
        self.assertEqual(forensics.aspect(800, 800)["orientation"], "square")

    def test_camera_hints(self):
        from core.services import forensics
        ex = Image.Exif()
        ex[0x010F], ex[0x0110] = "Canon", "Canon EOS R5"
        ex.get_ifd(0x8769)[0x920A] = 85.0
        buf = io.BytesIO()
        Image.new("RGB", (100, 100)).save(buf, "JPEG", exif=ex)
        buf.seek(0)
        hints = forensics.camera_hints(Image.open(buf))
        self.assertIn("shot on Canon EOS R5", hints)
        self.assertEqual(forensics.camera_hints(Image.new("RGB", (64, 64))), [])
