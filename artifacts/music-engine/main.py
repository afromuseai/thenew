"""
AfroMuse Music Engine — FastAPI backend.

A music generation spec service that converts client requests into a
structured spec consumable by an audio engine (ACE-Step or similar).
"""

from __future__ import annotations

import logging
import os
from typing import Any

import requests
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError, field_validator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("music-engine")

app = FastAPI(
    title="AfroMuse Music Engine",
    version="0.1.0",
    description="Structured music generation spec service for AfroMuse.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    """Inbound payload from the AfroMuse frontend."""

    prompt: str = Field(..., min_length=1, description="Free-form music idea / caption")
    key: str = Field(..., min_length=1, description="Musical key (e.g. 'A minor')")
    bpm: int = Field(..., gt=0, lt=400, description="Beats per minute")
    mood: str = Field(default="", description="Overall mood / vibe")
    artist_dna: str = Field(default="", description="Reference artist style fingerprint")
    beat_dna: str = Field(default="", description="Drum / groove fingerprint")

    @field_validator("prompt", "key")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class MusicSpec(BaseModel):
    caption: str
    key_scale: str
    bpm: int
    duration: int = 30
    genre: str = "afrobeat"
    mood: str = ""
    artist_dna: str = ""
    beat_dna: str = ""


class GenerateResponse(BaseModel):
    status: str
    audio_url: str
    spec: MusicSpec
    error: str | None = None


def build_spec(payload: GenerateRequest) -> MusicSpec:
    """Translate the inbound payload into a structured music spec."""
    return MusicSpec(
        caption=payload.prompt,
        key_scale=payload.key,
        bpm=payload.bpm,
        duration=30,
        genre="afrobeat",
        mood=payload.mood,
        artist_dna=payload.artist_dna,
        beat_dna=payload.beat_dna,
    )


ACE_STEP_URL = os.environ.get(
    "ACE_STEP_URL",
    "https://ace-step-ai-ace-step-v1-5.hf.space/run/predict",
)
ACE_STEP_TIMEOUT = float(os.environ.get("ACE_STEP_TIMEOUT", "120"))


def generate_music_with_engine(spec: MusicSpec) -> dict[str, Any]:
    """
    Generate music for a given spec by calling the ACE-Step Hugging Face Space.

    Sends the structured spec to the ACE-Step `/run/predict` endpoint and
    extracts the audio URL from the response. On any failure (network,
    non-2xx, malformed JSON, missing data) we log the full response body
    and return ``{"status": "error", ...}`` so the frontend can surface it.
    """
    spec_dict = spec.model_dump()

    payload = {
        "data": [
            spec_dict["caption"],
            spec_dict["genre"],
            spec_dict["mood"],
            spec_dict["key_scale"],
            spec_dict["bpm"],
            spec_dict["duration"],
        ]
    }

    print("ACE-Step Request:", {"url": ACE_STEP_URL, "payload": payload}, flush=True)
    logger.info("ACE-Step Request → %s payload=%s", ACE_STEP_URL, payload)

    try:
        response = requests.post(ACE_STEP_URL, json=payload, timeout=ACE_STEP_TIMEOUT)
    except requests.RequestException as exc:
        print("ACE-Step Network Error:", repr(exc), flush=True)
        logger.exception("ACE-Step network error")
        return {
            "status": "error",
            "audio_url": "",
            "spec": spec_dict,
            "error": f"ACE-Step request failed: {exc}",
        }

    raw_body = response.text
    print(
        "ACE-Step Response:",
        {"status_code": response.status_code, "body": raw_body[:2000]},
        flush=True,
    )
    logger.info(
        "ACE-Step Response status=%s body=%s",
        response.status_code,
        raw_body[:2000],
    )

    if not response.ok:
        return {
            "status": "error",
            "audio_url": "",
            "spec": spec_dict,
            "error": f"ACE-Step returned HTTP {response.status_code}",
        }

    try:
        data = response.json()
    except ValueError as exc:
        print("ACE-Step JSON parse error:", repr(exc), flush=True)
        logger.exception("ACE-Step JSON parse error")
        return {
            "status": "error",
            "audio_url": "",
            "spec": spec_dict,
            "error": "ACE-Step returned invalid JSON",
        }

    try:
        first = data["data"][0]
    except (KeyError, IndexError, TypeError) as exc:
        print("ACE-Step missing data[0]:", repr(exc), "full=", data, flush=True)
        logger.error("ACE-Step missing data[0]: %s — full=%s", exc, data)
        return {
            "status": "error",
            "audio_url": "",
            "spec": spec_dict,
            "error": "ACE-Step response did not include an audio URL",
        }

    # The Space may return a string URL or a richer dict — accept both shapes.
    if isinstance(first, str):
        audio_url = first
    elif isinstance(first, dict):
        audio_url = first.get("url") or first.get("name") or first.get("path") or ""
    else:
        audio_url = ""

    if not audio_url:
        print("ACE-Step empty audio URL — full=", data, flush=True)
        logger.error("ACE-Step empty audio URL — full=%s", data)
        return {
            "status": "error",
            "audio_url": "",
            "spec": spec_dict,
            "error": "ACE-Step response did not include a usable audio URL",
        }

    return {
        "status": "success",
        "audio_url": audio_url,
        "spec": spec_dict,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/generate", response_model=GenerateResponse)
def generate(payload: GenerateRequest) -> GenerateResponse:
    request_data = payload.model_dump()
    print("Incoming Request:", request_data, flush=True)
    logger.info("Incoming Request: %s", request_data)

    # Defensive guardrail: even though pydantic validates these, we re-check
    # so the contract message matches the product requirement exactly.
    if not payload.key or not str(payload.key).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Key and BPM are required for music generation",
        )
    if not payload.bpm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Key and BPM are required for music generation",
        )
    if not payload.prompt or not str(payload.prompt).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt is required for music generation",
        )

    try:
        spec = build_spec(payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.errors(),
        ) from exc

    # Hard contract: caption, key_scale, and bpm must always be present.
    if not spec.caption or not spec.key_scale or not spec.bpm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="caption, key_scale and bpm are required in the final spec",
        )

    spec_dict = spec.model_dump()
    print("Final Spec:", spec_dict, flush=True)
    logger.info("Final Spec: %s", spec_dict)

    result = generate_music_with_engine(spec)
    return GenerateResponse(**result)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("ENGINE_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
