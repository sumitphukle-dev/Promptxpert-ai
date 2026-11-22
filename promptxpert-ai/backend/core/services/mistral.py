"""Mistral API client. One key, server-side only.

Vision:  MISTRAL_VISION_MODEL (default mistral-small-latest, vision-capable, free tier).
Text:    MISTRAL_MODEL (default codestral-2508) - text-only prompt polishing.
         Codestral is a code model and does NOT accept images.
"""
import base64
import json
import os
import re
import time

import requests

from .prompts import EXTRA, EXTRA_LISTS, FIELDS, normalize

API = "https://api.mistral.ai/v1/chat/completions"


class MistralError(Exception):
    pass


def _key():
    k = os.getenv("MISTRAL_API_KEY")
    if not k:
        raise MistralError("The prompt generator is not configured (missing MISTRAL_API_KEY on the server).")
    return k


def _chat(model: str, messages: list, json_mode: bool, timeout: int = 60) -> str:
    body = {"model": model, "messages": messages, "temperature": 0.2, "max_tokens": 900}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    for attempt in range(2):
        try:
            r = requests.post(API, json=body, timeout=timeout,
                              headers={"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"})
        except requests.RequestException:
            raise MistralError("Could not reach the Mistral API. Try again in a moment.")
        if r.status_code == 429 and attempt == 0:
            time.sleep(2)
            continue
        if r.status_code == 429:
            raise MistralError("Mistral free-tier rate limit reached. Wait a minute and retry.")
        if r.status_code in (401, 403):
            raise MistralError("The server's Mistral API key was rejected.")
        if not r.ok:
            raise MistralError(f"Mistral returned an error ({r.status_code}). Try again.")
        try:
            return r.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, ValueError):
            raise MistralError("Unexpected response from Mistral.")
    raise MistralError("Mistral request failed.")


INSTRUCTION = (
    "You are analysing an image to help someone write a text-to-image prompt. Describe ONLY what is visible. "
    "Do not guess at the original prompt or the generator. Respond with a single JSON object with exactly these keys: "
    + ", ".join(FIELDS + EXTRA + EXTRA_LISTS)
    + ". secondary_objects, color_palette, uncertain_observations, keywords and style_tags are arrays of short strings "
    "(keywords: 10-14 single concepts a generator responds to, most important first; style_tags: 3-6 style or medium "
    "descriptors); the rest are short strings. art_medium is e.g. 'photograph', 'oil painting', '3D render', 'digital "
    "illustration'. lens_and_focus covers focal length feel and depth of field. alt_text is one plain sentence for a "
    "screen reader. negative_prompt lists things a generator should avoid to keep this look. Put anything ambiguous in "
    "uncertain_observations instead of inventing details."
)


def describe_image(raw: bytes, mime: str) -> tuple[dict, str]:
    model = os.getenv("MISTRAL_VISION_MODEL", "mistral-small-latest")
    data_url = f"data:{mime};base64,{base64.b64encode(raw).decode()}"
    msgs = [{"role": "user", "content": [{"type": "text", "text": INSTRUCTION},
                                         {"type": "image_url", "image_url": data_url}]}]
    text = _chat(model, msgs, json_mode=True, timeout=90)
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        return normalize(json.loads(text)), model
    except (ValueError, TypeError) as e:
        raise MistralError(f"The model's answer could not be validated ({e}). Please retry.")


def polish_prompt(draft: str, style: str) -> tuple[str, str]:
    model = os.getenv("MISTRAL_MODEL", "codestral-2508")
    msgs = [
        {"role": "system", "content": "You rewrite image-generation prompts. Keep every concrete visual detail, "
         "add no new objects, remove redundancy, and return only the final prompt text."},
        {"role": "user", "content": f"Style: {style}\nDraft prompt:\n{draft}"},
    ]
    return _chat(model, msgs, json_mode=False).strip().strip('"'), model


def variations(draft: str, n: int = 3) -> tuple[list[str], str]:
    model = os.getenv("MISTRAL_MODEL", "codestral-2508")
    msgs = [
        {"role": "system", "content": 'You write image-generation prompts. Reply with JSON: {"variations": [..]} holding exactly '
         "the requested number of different prompts. Keep the subject and every concrete detail; vary only camera, lighting, "
         "mood or art style. Add no new objects."},
        {"role": "user", "content": f"Number of variations: {n}\nBase prompt:\n{draft}"},
    ]
    text = re.sub(r"^```(?:json)?|```$", "", _chat(model, msgs, json_mode=True).strip(), flags=re.M).strip()
    try:
        items = [str(x).strip() for x in json.loads(text).get("variations", []) if str(x).strip()][:n]
    except (ValueError, AttributeError):
        items = []
    if not items:
        raise MistralError("The model returned no usable variations.")
    return items, model


TRANSFORMS = {
    "expand": "Add richer concrete visual detail (materials, light quality, texture) without adding new objects or changing the subject. Make it roughly 1.5x longer.",
    "shorten": "Cut it to the essential visual details, about half the length. Keep subject, setting, lighting and style.",
    "polish": "Remove redundancy and awkward wording while keeping every concrete detail.",
    "reimagine": "Rewrite so the same scene is rendered in this style: {arg}. Keep the subject and composition; replace style, medium and lighting cues to fit.",
    "translate": "Translate into {arg}. Keep technical flags (like --ar, --style) and (word:1.2) weights exactly as they are.",
    "negative": "Write a comma-separated negative prompt of defects to avoid for this scene (artifacts, anatomy errors, text, watermarks). Return only the list.",
}


def transform(text: str, mode: str, arg: str = "") -> tuple[str, str]:
    model = os.getenv("MISTRAL_MODEL", "codestral-2508")
    msgs = [
        {"role": "system", "content": "You edit image-generation prompts. Return only the resulting prompt text, with no "
         "commentary or quotes. " + TRANSFORMS[mode].format(arg=arg)},
        {"role": "user", "content": text[:2500]},
    ]
    return _chat(model, msgs, json_mode=False).strip().strip('"'), model
