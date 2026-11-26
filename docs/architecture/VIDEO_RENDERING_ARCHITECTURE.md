# Video Rendering Architecture (Server-Side FFmpeg Pipeline)

**Last Updated:** 2026-11-26

---

## 1. Overview

`server/services/ffmpegService.ts` provides genuine server-side `.mp4` rendering using the container's `ffmpeg` binary (`libx264` + `aac` + `libass`), exposing async job endpoints through Express (`server/app.ts`):

- `GET /api/render/status` — reports local FFmpeg availability, exact version string, and optional external worker configuration.
- `POST /api/render/jobs` — creates an isolated render job inside `os.tmpdir()/neural-symphony-renders/<jobId>` and returns HTTP `202` with initial `RenderJobStatus`.
- `GET /api/render/jobs/:id` — returns live stage, percentage progress, warnings, or error details.
- `GET /api/render/jobs/:id/output` — downloads the finished `.mp4` file once `status === 'completed'`.

---

## 2. Security & Command Safety

- **Zero Shell Interpolation**: Every FFmpeg execution invokes `execFile('ffmpeg', argsArray, { shell: false })`. No user-supplied strings (`projectName`, lyrics, filenames) ever pass through `/bin/sh`.
- **Sandboxed Temp Paths**: Every input/intermediate/output path is resolved via `path.resolve(...)` and verified with `isPathInside(targetPath, jobDir)` (checking `=== base || startsWith(base + path.sep)`).
- **Local Asset Boundary**: Demo reference images referenced by `/src/assets/images/...` are resolved strictly inside `src/assets/images/` with path confinement validation.

---

## 3. Multi-Stage Assembly Pipeline

1. **Segment Normalization**: Each timeline block (`videoDataUrl` from a real clip or `imageDataUrl` from an offline/reference still) is decoded into the sandboxed job directory and encoded into a normalized H.264 / `yuv420p` intermediate `.mp4` scaled and padded to the configured `exportSettings.width x height` and `fps`.
2. **Concatenation**: Intermediate segments are concatenated losslessly via `-f concat -safe 0 -i concat_list.txt -c copy`.
3. **Multilingual Unicode Subtitles**: When `exportSettings.burnSubtitles` is active and synced `lyrics` exist (English, Amharic Ethiopic script, Afaan Oromoo), `buildSrtContent()` generates a UTF-8 `.srt` subtitle track burned in via FFmpeg `subtitles` (`libass`). If missing fonts cause a subtitle filter failure on exotic glyphs, the renderer logs a non-fatal warning and preserves the clean video export.
4. **Master Audio Muxing**: When `exportSettings.includeAudio` is checked and `musicAsset.dataUrl` is present, audio is encoded to AAC (`192k`) and muxed with `-shortest -movflags +faststart`.
