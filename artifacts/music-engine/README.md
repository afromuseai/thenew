# AfroMuse Music Engine

FastAPI service that turns client requests into a structured music
generation spec. Currently returns a mock `audio_url`; swap
`generate_music_with_engine` for a real ACE-Step / external API call.

## Run

```bash
python artifacts/music-engine/main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir artifacts/music-engine
```

## Endpoint

`POST /generate`

```json
{
  "prompt": "Lagos sunset drive",
  "key": "A minor",
  "bpm": 102,
  "mood": "uplifting",
  "artist_dna": "Burna Boy",
  "beat_dna": "amapiano log drum"
}
```
