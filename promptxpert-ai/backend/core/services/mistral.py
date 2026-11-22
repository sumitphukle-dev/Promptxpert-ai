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

from .prompts import FIELDS, normalize

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
    + ", ".join(FIELDS)
    + ". secondary_objects, color_palette and uncertain_observations are arrays of short strings; the rest are short "
    "strings. Put anything ambiguous in uncertain_observations instead of inventing details."
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
