"""
AfroMuse Music Engine — FastAPI backend.

A music generation spec service that converts client requests into a
structured spec consumable by an audio engine (ACE-Step or similar).
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
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


VOCAL_LANGUAGES = {
    "ar", "az", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "es",
    "fa", "fi", "fr", "he", "hi", "hr", "ht", "hu", "id", "is", "it",
    "ja", "ko", "la", "lt", "ms", "ne", "nl", "no", "pa", "pl", "pt",
    "ro", "ru", "sa", "sk", "sr", "sv", "sw", "ta", "te", "th", "tl",
    "tr", "uk", "ur", "vi", "yue", "zh", "unknown",
}


class GenerateRequest(BaseModel):
    """Inbound payload from the AfroMuse frontend."""

    prompt: str = Field(..., min_length=1, description="Free-form music idea / caption")
    key: str = Field(..., min_length=1, description="Musical key (e.g. 'A minor')")
    bpm: int = Field(..., gt=0, lt=400, description="Beats per minute")
    mood: str = Field(default="", description="Overall mood / vibe")
    artist_dna: str = Field(default="", description="Reference artist style fingerprint")
    beat_dna: str = Field(default="", description="Drum / groove fingerprint")
    vocal_language: str = Field(
        default="en",
        description="ISO code for vocal language passed to ACE-Step (e.g. 'en', 'fr', 'sw').",
    )
    duration: int = Field(
        default=12,
        ge=5,
        le=240,
        description="Audio duration in seconds for ACE-Step generation.",
    )

    @field_validator("prompt", "key")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("vocal_language")
    @classmethod
    def _normalize_lang(cls, v: str) -> str:
        v = (v or "").strip().lower() or "unknown"
        return v if v in VOCAL_LANGUAGES else "unknown"


class MusicSpec(BaseModel):
    caption: str
    prompt: str
    tag_prompt: str
    key_scale: str
    bpm: int
    duration: int = 12
    genre: str = "afrobeat"
    mood: str = ""
    artist_dna: str = ""
    beat_dna: str = ""
    vocal_language: str = "en"


class GenerateResponse(BaseModel):
    status: str
    audio_url: str
    spec: MusicSpec
    error: str | None = None


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _build_tag_prompt(
    genre: str,
    mood: str,
    artist_dna: str,
    beat_dna: str,
) -> str:
    """
    Build the comma-separated tag string for ACE-Step's `custom` mode
    Prompt input (slot [4]) — short, descriptor-style tags only.
    """
    tags: list[str] = []
    for raw in (genre, mood, artist_dna, beat_dna):
        for token in (_clean(raw)).split(","):
            token = token.strip()
            if token and token.lower() not in {t.lower() for t in tags}:
                tags.append(token)
    return ", ".join(tags)


def expand_beat_dna(beat_dna: str) -> str:
    """
    Expand a free-form beat DNA descriptor into a richer instrumentation
    line for the AfroMuse caption. Falls back to a canonical afrobeats kit
    when the user didn't provide one.
    """
    bd = _clean(beat_dna)
    base_kit = "log drums, shakers, kick-snare-hat groove, talking drum accents"
    if not bd:
        return base_kit
    return f"{bd}, {base_kit}"


def build_afromuse_caption(spec: dict[str, Any]) -> str:
    beat = expand_beat_dna(spec["beat_dna"])

    return f"""
STYLE: Afrobeat

HARMONY:
- Key: {spec["key"]}

RHYTHM:
- BPM: {spec["bpm"]} mid-tempo afrobeat swing
- Groove: log drum driven rhythm

INSTRUMENTATION:
- {beat}
- {spec["artist_dna"]}

MOOD:
- {spec["mood"]}

STRUCTURE:
- intro → hook → verse → hook

PRODUCTION:
- modern afrobeats, Ghanaian highlife influence
- clean studio mix

HARMONIC_TONE:
- key-driven melodic composition
"""


def build_spec(payload: GenerateRequest) -> MusicSpec:
    """Translate the inbound payload into a structured music spec."""
    genre = "afrobeat"
    caption = build_afromuse_caption(
        {
            "prompt": payload.prompt,
            "key": payload.key,
            "bpm": payload.bpm,
            "mood": payload.mood,
            "artist_dna": payload.artist_dna,
            "beat_dna": payload.beat_dna,
        }
    )
    tag_prompt = _build_tag_prompt(
        genre=genre,
        mood=payload.mood,
        artist_dna=payload.artist_dna,
        beat_dna=payload.beat_dna,
    )
    return MusicSpec(
        caption=caption,
        prompt=payload.prompt,
        tag_prompt=tag_prompt,
        key_scale=payload.key,
        bpm=payload.bpm,
        duration=payload.duration,
        genre=genre,
        mood=payload.mood,
        artist_dna=payload.artist_dna,
        beat_dna=payload.beat_dna,
        vocal_language=payload.vocal_language,
    )


def _derive_base_url(raw: str) -> str:
    """Strip legacy `/run/predict` (or trailing slashes) from the configured URL."""
    base = (raw or "").strip().rstrip("/")
    for suffix in ("/run/predict", "/api/predict", "/gradio_api/queue/join"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
    return base.rstrip("/")


ACE_STEP_BASE_URL = _derive_base_url(
    os.environ.get(
        "ACE_STEP_BASE_URL",
        os.environ.get(
            "ACE_STEP_URL",
            "https://ace-step-ace-step-v1-5.hf.space",
        ),
    )
)
ACE_STEP_FN_INDEX = int(os.environ.get("ACE_STEP_FN_INDEX", "77"))
ACE_STEP_API_NAME = os.environ.get("ACE_STEP_API_NAME", "generation_wrapper")
ACE_STEP_MODEL = os.environ.get("ACE_STEP_MODEL", "acestep-v15-xl-turbo")
ACE_STEP_GENERATION_MODE = os.environ.get("ACE_STEP_GENERATION_MODE", "custom").strip().lower()
ACE_STEP_TIMEOUT = float(os.environ.get("ACE_STEP_TIMEOUT", "240"))
ACE_STEP_CONNECT_TIMEOUT = float(os.environ.get("ACE_STEP_CONNECT_TIMEOUT", "30"))


def _build_generation_wrapper_payload(spec: MusicSpec) -> list[Any]:
    """
    Build the 54-element input array for ACE-Step's `generation_wrapper`
    (fn_index=77).

    We default to ``custom`` mode so the Space's structured inputs (Prompt
    tags, Lyrics, BPM, Key Signature, Vocal Language) actually drive
    generation — instead of all of our spec collapsing into the single
    `simple_query_input` text box. The simple_* slots are still populated
    with the rich caption + vocal language as a safety fallback in case
    the Space ever ignores the custom-mode fields.
    """
    mode = ACE_STEP_GENERATION_MODE if ACE_STEP_GENERATION_MODE in {"simple", "custom"} else "custom"

    return [
        # [ 0] selected_model — Literal['acestep-v15-xl-turbo','acestep-v15-turbo']
        ACE_STEP_MODEL,
        # [ 1] generation_mode — 'custom' uses slots [4..9], 'simple' uses [2..3]
        mode,
        # [ 2] simple_query_input — rich caption (also a fallback for custom mode)
        spec.caption,
        # [ 3] simple_vocal_language — ISO code (also a fallback for custom mode)
        spec.vocal_language,
        # [ 4] Prompt (custom mode) — comma-separated descriptor tags
        spec.tag_prompt,
        # [ 5] Lyrics (custom mode) — instrumental for now
        "",
        # [ 6] BPM (custom mode) — user-controlled
        int(spec.bpm),
        # [ 7] Key Signature (custom mode) — user-controlled
        spec.key_scale,
        # [ 8] Time Signature (custom mode) — Literal['','2','3','4'], default to ''
        "",
        # [ 9] Vocal Language (custom mode) — ISO code
        spec.vocal_language,
        # [10] DiT Inference Steps
        8,
        # [11] (slider) — CFG scale-ish
        7.0,
        # [12] Random Seed
        True,
        # [13] Seed
        "-1",
        # [14] Reference Audio (optional)
        None,
        # [15] Audio Duration (seconds) — REQUIRED user-controlled
        float(spec.duration),
        # [16] batch size
        2,
        # [17] Source Audio (cover/repaint only)
        None,
        # [18] Audio Codes (repaint only)
        None,
        # [19] Start (seconds)
        0.0,
        # [20] End (seconds, -1 for end)
        -1,
        # [21] (textbox) — semantic mask prompt
        "Fill the audio semantic mask based on the given conditions:",
        # [22] (slider)
        1.0,
        # [23] task — Literal['text2music','repaint','cover']
        "text2music",
        # [24] (checkbox)
        False,
        # [25] (slider)
        0.0,
        # [26] (slider)
        1.0,
        # [27] Shift
        3.0,
        # [28] Inference Method — Literal['ode','sde']
        "ode",
        # [29] Custom Timesteps
        "",
        # [30] Audio Format — Literal['mp3','flac']
        "mp3",
        # [31] LM Temperature
        0.85,
        # [32] Thinking
        True,
        # [33] LM CFG Scale
        2.0,
        # [34] LM Top-K
        0,
        # [35] LM Top-P
        0.9,
        # [36] LM Negative Prompt
        "NO USER INPUT",
        # [37-39] feature toggles
        True, True, True,
        # [40] state — None
        None,
        # [41-42] more checkboxes
        False, True,
        # [43] Get Scores
        False,
        # [44] Get LRC
        False,
        # [45] (slider)
        0.5,
        # [46] (number)
        8,
        # [47] (dropdown)
        None,
        # [48] (checkboxgroup)
        [],
        # [49] (checkbox)
        False,
        # [50-53] state slots
        None, None, None, None,
    ]


def _extract_audio_url(first: Any) -> str:
    """Normalize the first output item from a Gradio response into an audio URL."""
    if isinstance(first, str):
        url = first
    elif isinstance(first, dict):
        url = (
            first.get("url")
            or first.get("path")
            or first.get("name")
            or ""
        )
    else:
        url = ""

    if url and url.startswith("/"):
        url = f"{ACE_STEP_BASE_URL}{url}"
    return url


def generate_music_with_engine(spec: MusicSpec) -> dict[str, Any]:
    """
    Generate music by calling the ACE-Step Hugging Face Space via the
    Gradio queue-based API.

    Flow:
      1. POST {base}/gradio_api/queue/join with the input payload + a
         per-request session_hash → returns ``{"event_id": "..."}``.
      2. Open an SSE stream from {base}/gradio_api/queue/data?session_hash=...
         and read events until we see ``msg: "process_completed"`` (success)
         or a terminal error event.
      3. Extract the audio URL from ``output.data[0]``.

    On any failure (network, non-2xx, malformed event stream, timeout,
    missing data) we log the full context and return ``{"status": "error", ...}``
    so the frontend can render a stable shape.
    """
    spec_dict = spec.model_dump()

    payload_data = _build_generation_wrapper_payload(spec)

    session_hash = uuid.uuid4().hex[:12]
    join_url = f"{ACE_STEP_BASE_URL}/gradio_api/queue/join"
    data_url = f"{ACE_STEP_BASE_URL}/gradio_api/queue/data"

    join_payload = {
        "data": payload_data,
        "event_data": None,
        "fn_index": ACE_STEP_FN_INDEX,
        "trigger_id": ACE_STEP_FN_INDEX,
        "api_name": ACE_STEP_API_NAME,
        "session_hash": session_hash,
    }

    print(
        "ACE-Step queue/join Request:",
        {"url": join_url, "payload": join_payload},
        flush=True,
    )
    logger.info("ACE-Step queue/join → %s payload=%s", join_url, join_payload)

    try:
        join_resp = requests.post(
            join_url,
            json=join_payload,
            timeout=ACE_STEP_CONNECT_TIMEOUT,
        )
    except requests.RequestException as exc:
        print("ACE-Step queue/join network error:", repr(exc), flush=True)
        logger.exception("ACE-Step queue/join network error")
        return {
            "status": "error",
            "audio_url": "",
            "spec": spec_dict,
            "error": f"ACE-Step queue/join failed: {exc}",
        }

    join_body = join_resp.text
    print(
        "ACE-Step queue/join Response:",
        {"status_code": join_resp.status_code, "body": join_body[:2000]},
        flush=True,
    )
    logger.info(
        "ACE-Step queue/join Response status=%s body=%s",
        join_resp.status_code,
        join_body[:2000],
    )

    if not join_resp.ok:
        return {
            "status": "error",
            "audio_url": "",
            "spec": spec_dict,
            "error": f"ACE-Step queue/join returned HTTP {join_resp.status_code}",
        }

    try:
        join_json = join_resp.json()
    except ValueError:
        join_json = {}

    event_id = join_json.get("event_id") if isinstance(join_json, dict) else None
    print(
        "ACE-Step queue/join accepted:",
        {"event_id": event_id, "session_hash": session_hash},
        flush=True,
    )

    # ---- Poll the SSE event stream -----------------------------------------
    print(
        "ACE-Step queue/data Stream:",
        {"url": data_url, "session_hash": session_hash, "timeout": ACE_STEP_TIMEOUT},
        flush=True,
    )
    logger.info(
        "ACE-Step queue/data ← %s session_hash=%s", data_url, session_hash
    )

    deadline = time.monotonic() + ACE_STEP_TIMEOUT

    try:
        with requests.get(
            data_url,
            params={"session_hash": session_hash},
            stream=True,
            timeout=(ACE_STEP_CONNECT_TIMEOUT, ACE_STEP_TIMEOUT),
            headers={"Accept": "text/event-stream"},
        ) as stream:
            if not stream.ok:
                body = stream.text[:2000]
                print(
                    "ACE-Step queue/data non-2xx:",
                    {"status_code": stream.status_code, "body": body},
                    flush=True,
                )
                logger.error(
                    "ACE-Step queue/data status=%s body=%s",
                    stream.status_code,
                    body,
                )
                return {
                    "status": "error",
                    "audio_url": "",
                    "spec": spec_dict,
                    "error": f"ACE-Step queue/data returned HTTP {stream.status_code}",
                }

            for raw_line in stream.iter_lines(decode_unicode=True):
                if time.monotonic() > deadline:
                    print("ACE-Step queue/data timeout reached", flush=True)
                    logger.error("ACE-Step queue/data timeout after %ss", ACE_STEP_TIMEOUT)
                    return {
                        "status": "error",
                        "audio_url": "",
                        "spec": spec_dict,
                        "error": (
                            f"ACE-Step generation timed out after {int(ACE_STEP_TIMEOUT)}s"
                        ),
                    }

                if not raw_line:
                    continue
                if not raw_line.startswith("data:"):
                    continue

                payload_str = raw_line[len("data:"):].strip()
                if not payload_str:
                    continue

                try:
                    event = json.loads(payload_str)
                except ValueError:
                    print("ACE-Step skipping non-JSON SSE line:", payload_str[:200], flush=True)
                    continue

                msg = event.get("msg") if isinstance(event, dict) else None
                print("ACE-Step SSE event:", {"msg": msg, "event": str(event)[:500]}, flush=True)
                logger.info("ACE-Step SSE event msg=%s", msg)

                if msg in {"queue_full", "unexpected_error"}:
                    return {
                        "status": "error",
                        "audio_url": "",
                        "spec": spec_dict,
                        "error": f"ACE-Step rejected the job: {msg}",
                    }

                if msg == "process_completed":
                    success = event.get("success", True)
                    output = event.get("output") or {}
                    out_data = output.get("data") if isinstance(output, dict) else None

                    if not success or not out_data:
                        err_detail = (
                            output.get("error")
                            if isinstance(output, dict)
                            else None
                        ) or "ACE-Step completed without output data"
                        print(
                            "ACE-Step process_completed failure:",
                            {"event": str(event)[:2000]},
                            flush=True,
                        )
                        logger.error(
                            "ACE-Step process_completed failure event=%s",
                            str(event)[:2000],
                        )
                        return {
                            "status": "error",
                            "audio_url": "",
                            "spec": spec_dict,
                            "error": str(err_detail),
                        }

                    # generation_wrapper returns 55 outputs:
                    #   [0..7]  = the 8 sample audio components (sent as Gradio
                    #            'update' objects in the final frame — empty here)
                    #   [8]     = "📁 All Generated Files (Download)" — a LIST of
                    #            filepath dicts {path, url, ...}; THIS is where
                    #            the real audio URLs live in the completed event.
                    #   [10]    = "Generation Status" string.
                    audio_url = ""
                    files_list = out_data[8] if len(out_data) > 8 else None
                    if isinstance(files_list, list):
                        for item in files_list:
                            candidate = _extract_audio_url(item)
                            if candidate:
                                audio_url = candidate
                                break

                    # Fallback: some Space versions put filepaths directly in
                    # slots [0..7] instead of as Gradio 'update' wrappers.
                    if not audio_url:
                        for idx in range(min(8, len(out_data))):
                            candidate = _extract_audio_url(out_data[idx])
                            if candidate:
                                audio_url = candidate
                                break

                    if not audio_url:
                        gen_status = (
                            out_data[10] if len(out_data) > 10 else None
                        )
                        print(
                            "ACE-Step empty audio URL in completion:",
                            {
                                "samples_0_7": out_data[:8],
                                "generation_status": gen_status,
                            },
                            flush=True,
                        )
                        logger.error(
                            "ACE-Step empty audio URL — samples=%s status=%s",
                            out_data[:8],
                            gen_status,
                        )
                        return {
                            "status": "error",
                            "audio_url": "",
                            "spec": spec_dict,
                            "error": (
                                f"ACE-Step generation produced no audio: {gen_status}"
                                if gen_status
                                else "ACE-Step completion did not include a usable audio URL"
                            ),
                        }

                    print(
                        "ACE-Step success:",
                        {"audio_url": audio_url, "session_hash": session_hash},
                        flush=True,
                    )
                    return {
                        "status": "success",
                        "audio_url": audio_url,
                        "spec": spec_dict,
                    }

    except requests.RequestException as exc:
        print("ACE-Step queue/data network error:", repr(exc), flush=True)
        logger.exception("ACE-Step queue/data network error")
        return {
            "status": "error",
            "audio_url": "",
            "spec": spec_dict,
            "error": f"ACE-Step queue/data failed: {exc}",
        }

    # Stream ended without process_completed
    print("ACE-Step SSE stream ended without completion", flush=True)
    logger.error("ACE-Step SSE stream ended without process_completed")
    return {
        "status": "error",
        "audio_url": "",
        "spec": spec_dict,
        "error": "ACE-Step stream closed before generation completed",
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
