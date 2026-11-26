# Integration & Implementation Audit 02 — Neural Symphony Studio

**Audit Date:** 2026-11-26  
**Scope:** Full verification of the initial implementation prior to Integration Hardening & Live ComfyUI/FFmpeg wiring.

---

## 1. Verified Functionality (Confirmed in Actual Source Code & Tests)

- **Frontend Shell & 16 Navigation Sections**: `src/App.tsx`, `src/components/layout/StudioShell.tsx`, and all 16 domain views exist and render without runtime errors.
- **IndexedDB Persistence (`src/services/storage/indexedDbStore.ts`)**: Projects, active project ID, and studio settings persist across browser reloads via `neural_symphony_studio_db` with `localStorage` fallback.
- **Portable ZIP Project Archive (`src/modules/persistence/projectArchive.ts`)**: Uses `JSZip` to export and validate/re-import `manifest.json`, `project.json`, `character_bible.json`, `scene_plan.json`, `prompt_history.json`, `timeline.json`, `workflows/*.json`, and `lyrics.lrc` while preserving `extraMetadata`.
- **Media Ingestion (`src/modules/media-ingestion/mediaImporter.ts`)**: Supports JPG/PNG/WEBP and `.zip` batch extraction with SHA-256 duplicate detection and non-destructive thumbnail creation.
- **Pure Logic & Unit Tests**: 10/10 tests pass via `npx --yes tsx --test` across `engineRules`, `promptCompiler`, `characterMatcher`, `lyricsParser`, and `projectArchive`.
- **Credential Isolation**: `GEMINI_API_KEY` is accessed only in `server/services/geminiService.ts`; no Gemini API key input fields exist in `src/`.

---

## 2. Partially Implemented Functionality

1. **ComfyUI Proxy (`server/services/comfyuiProxy.ts`, `server.ts`)**
   - *Implemented*: `/api/comfyui/test` (`/system_stats`), `/api/comfyui/models` (`/object_info`), `/api/comfyui/queue`, `/api/comfyui/prompt`, `/api/comfyui/history`, `/api/comfyui/interrupt`.
   - *Incomplete*: No image upload route (`/upload/image`), no output binary retrieval (`/view`), no WebSocket (`/ws`) execution progress monitoring, no job-completion polling, no authentication token forwarding, and no `connecting` / `authentication_required` / `unreachable` / `configuration_invalid` status taxonomy.
2. **LTX-Video 0.9.5 & Wan 2.1 Adapters (`src/modules/generation-engine/engineRules.ts`)**
   - *Implemented*: Parameter constraint snapping (`8n+1` for LTX, `4n+1` for Wan) and template JSON skeletons.
   - *Incomplete*: No distinction between ComfyUI **API-format** JSON and **UI-format** JSON (`nodes`/`links`); no inspection of connected ComfyUI `/object_info` to verify whether `LTXVImgToVideo`, `WanImageToVideo`, `VHS_VideoCombine`, or target checkpoints are actually installed; incomplete parameter injection for `SamplerCustom`/`LTXVScheduler`/`SaveVideo` nodes.
3. **Generation Queue (`src/hooks/useStudioStore.ts`, `GenerationAndQueueViews.tsx`)**
   - *Implemented*: Separates `comfyui_live` vs `offline_simulation` flags and persists jobs in IndexedDB.
   - *Incomplete*: Missing `submitting`, `queued`, `interrupted` statuses, `workflowId`, `outputFiles`, `currentNode`, and retry failed job capability; live ComfyUI jobs stall in `pending` after submission because nothing monitors completion or downloads outputs.
4. **Qwen2.5-VL Proxy (`server.ts`)**
   - *Implemented*: `POST /api/vision/analyze` forwarding to `${endpointUrl}/v1/chat/completions`.
   - *Incomplete*: No connection test endpoint (`/api/vision/test`), no retry/timeout polish, no server-side auth header (`QWEN_VL_API_KEY`), and no client/project analysis cache check before re-uploading identical image payloads.
5. **Gemini Integration (`server/services/geminiService.ts`)**
   - *Implemented*: Multimodal image analysis, scene planning, and prompt synthesis via `@google/genai`.
   - *Incomplete*: Hardcoded `'gemini-4-hydrogen'` model string across all calls; lacks configurable model selection, explicit timeout handling, and structured 429 rate-limit / 401/403 error translation.
6. **FFmpeg Video Assembly (`server.ts`, `ExportCenterView`)**
   - *Implemented*: Detects local `ffmpeg` binary (`Available` in container) and downloads an `assemble_music_video.sh` script.
   - *Incomplete*: No real server-side FFmpeg rendering pipeline (`execFile` job queue, clip/image concatenation, audio muxing, optional `.srt` Unicode subtitle burn-in, progress tracking, and `.mp4` download).

---

## 3. Missing Functionality

- Live ComfyUI WebSocket (`/ws`) client manager & SSE progress bridge (`/api/comfyui/events/:clientId`).
- ComfyUI `/upload/image` and `/view` proxy routes for reference frame upload and video/image output retrieval.
- Lightweight ComfyUI End-to-End Integration Test Workflow runner & diagnostic report view.
- Real FFmpeg rendering job service (`server/services/ffmpegService.ts`) producing downloadable MP4 files.
- API integration & mock server tests covering `/api/comfyui/*`, `/api/vision/*`, `/api/gemini/*`, and `/api/render/*`.

---

## 4. Technical Risks & Incorrect Assumptions

1. **Image Input Gap**: Submitting an LTX/Wan workflow referencing `fileName` fails on a real ComfyUI server unless the image was first uploaded via `POST /upload/image` and the returned ComfyUI filename/subfolder is injected into `LoadImage`.
2. **UI-Format vs API-Format Confusion**: Users exporting standard ComfyUI `.json` graphs (`nodes: [...]`) will encounter cryptic server errors unless the validator explicitly detects UI-format JSON and guides them to export API format.
3. **SSRF & Secret Boundary Risk**: External ComfyUI/Qwen URLs must undergo strict URL validation blocking cloud metadata endpoints (`169.254.169.254`), and optional API tokens (`COMFYUI_API_TOKEN`, `QWEN_VL_API_KEY`) must remain strictly on the Express server via `.env` / `process.env`.
4. **Shell Injection Risk in FFmpeg**: All FFmpeg invocations must use `execFile('ffmpeg', argsArray, { shell: false })` with validated temporary workspace paths inside `os.tmpdir()`.

---

## 5. Files Requiring Modification & Addition

- **Modify**: `.env.example`, `src/types/studio.ts`, `server/services/urlGuard.ts`, `server/services/comfyuiProxy.ts`, `server/services/geminiService.ts`, `server.ts`, `src/modules/generation-engine/engineRules.ts`, `src/modules/persistence/projectArchive.ts`, `src/services/api/studioApi.ts`, `src/hooks/useStudioStore.ts`, `src/components/generation/GenerationAndQueueViews.tsx`, `src/components/characters/IntelligenceAndCharactersViews.tsx`, `src/components/workflows/ExportWorkflowsModelsMonitorSettings.tsx`, `src/components/dashboard/DashboardView.tsx`.
- **Add**: `server/services/comfyuiMonitor.ts`, `server/services/qwenService.ts`, `server/services/ffmpegService.ts`, `server/services/apiRoutes.test.ts`, `docs/architecture/LTX_COMFYUI_INTEGRATION.md`, `docs/architecture/VIDEO_RENDERING_ARCHITECTURE.md`, `docs/development/COMFYUI_TEST_REPORT.md`.

---

## 6. Recommended Implementation Order

1. Harden `.env.example`, URL guard, ComfyUI status taxonomy, auth header handling, `/upload/image`, `/view`, `/ws` live monitor + SSE bridge, and E2E integration test workflow.
2. Harden LTX-Video 0.9.5 & Wan 2.1 adapters (UI-vs-API format detection, `/object_info` node/model capability checks, flexible node parameter injection).
3. Harden Generation Queue (`submitting`, `queued`, `running`, `completed`, `failed`, `cancelled`, `interrupted`, retry failed job, output clip persistence).
4. Harden Qwen2.5-VL proxy (`/api/vision/test`, retries, cache check) and Gemini proxy (configurable model layer, rate-limit errors, timeouts).
5. Build real `execFile`-safe FFmpeg rendering service (`server/services/ffmpegService.ts`) + Export Center render job UI.
6. Run unit tests, mocked ComfyUI/Vision/FFmpeg API integration tests, `tsc --noEmit`, `vite build`, and Chromium browser verification.
