# Media Tools

Use the native `media` tool as the Media Generation executor through the configured 9router gateway. Do not run shell or CLI commands for media generation.

Use `media` when the user asks for media endpoint status, media model availability, image generation, text-to-speech, speech-to-text, or embeddings. Use `resources` when the user asks which external sources or skills are configured.

## Tool Boundaries

| Intent | Tool |
| --- | --- |
| Workspace source/skill registry | `resources` |
| 9router media status/models/voices | `media` |
| Generate image/audio/transcription/embedding | `media` |
| Attach generated image to Studio output | `studio` first, then `media generate-image` with `outputId` |

## Commands

- `media({ command: "status" })` — show active 9router media availability.
- `media({ command: "models image" })` — list image generation models.
- `media({ command: "models tts" })` — list text-to-speech models.
- `media({ command: "models stt" })` — list speech-to-text models.
- `media({ command: "models embedding" })` — list embedding models.
- `media({ command: "voices" })` — list TTS voices when the 9router instance supports `/audio/voices`.
- `media({ command: "generate-image {json}" })` — generate an image.
- `media({ command: "speech {json}" })` — generate speech audio.
- `media({ command: "transcribe {json}" })` — transcribe an audio file inside the current session.
- `media({ command: "embed {json}" })` — create embeddings and save the JSON result.

## JSON payloads

Image:

```json
{"prompt":"cinematic product hero image","model":"openai/gpt-image-1","size":"1024x1024","format":"png"}
```

Studio image asset:

```json
{"outputId":"studio-output-id","assetId":"hero-image","prompt":"cinematic product hero image","model":"openai/gpt-image-1","size":"1024x1024"}
```

Speech:

```json
{"text":"Welcome to the launch demo.","model":"openai/tts-1","voice":"alloy","format":"mp3"}
```

Transcription:

```json
{"path":"C:\\...\\sessions\\current\\data\\media\\speech.mp3","model":"openai/whisper-1"}
```

Embeddings:

```json
{"input":"Text to embed","model":"openai/text-embedding-3-small"}
```

## Routing rules

- Use chat LLM for reasoning and prompt/brief writing.
- Use `media` for the actual media endpoint call.
- Do not send image/TTS/STT/embedding-only models through chat completions.
- For generated images, include the returned `image-preview` block in the response.
- For Studio image work, create/update the Studio output first, then call `media generate-image` with `outputId` so the asset is attached to metadata.

## Safety

- Outputs are written only under current session data or Studio asset paths.
- Credentials stay server-side.
- Unsupported 9router endpoints return an explicit unsupported error; do not fake media output.
