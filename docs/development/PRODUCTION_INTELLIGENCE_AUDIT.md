# Production Intelligence & AI Model Orchestration Audit

**Date:** 2026-11-26  
**Audited Scope:** `src/`, `server/`, `docs/`, `.env.example`, `package.json`, and automated test suites  
**Objective:** Establish a verified architectural baseline before implementing **Master Development Prompt 03** (Multi-Provider AI Model Orchestration, Task Routing, Pre-Production Studio, Unified Document Management, Tigrigna Multilingual Support, and Production Continuity).

---

## 1. Verified Existing Architecture

1. **Frontend Workspace & Navigation (`src/`)**:
   - React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (`@import "tailwindcss";` with dark-first studio CSS variables and working dark/light toggle).
   - 16 implemented navigation sections inside `src/components/layout/StudioShell.tsx`: `dashboard`, `projects`, `media`, `intelligence`, `characters`, `scenes`, `prompts`, `generation`, `queue`, `timeline`, `music`, `export`, `workflows`, `models`, `monitor`, `settings`.
   - Client state managed in `src/hooks/useStudioStore.ts` with debounced autosave into browser IndexedDB (`neural_symphony_studio_db`, `localStorage` fallback).
   - Portable `.nss.zip` export/import in `src/modules/persistence/projectArchive.ts` with `manifest.json`, `project.json`, `character_bible.json`, `scene_plan.json`, `prompt_history.json`, `timeline.json`, `media/*`, `workflows/*.json`, and `lyrics.lrc`.

2. **Server Integration Layer (`server.ts`, `server/app.ts`, `server/services/`)**:
   - `urlGuard.ts`: Validates `http://` / `https://`, blocks embedded URL credentials, blocks cloud metadata IPs (`169.254.169.254`, `metadata.google.internal`, `100.100.100.200`, `0.0.0.0`, `::`), and sanitizes ComfyUI filenames/subfolders.
   - `geminiService.ts`: Uses `@google/genai` server-side with `GEMINI_API_KEY` from `process.env`, restricts models to safe defaults (`gemini-4-hydrogen`, `gemini-3.1-flash-lite`), enforces request timeouts, and translates `429`/`401`/`403`/`404` failures cleanly.
   - `qwenService.ts`: Proxies `/api/vision/test` and `/api/vision/analyze` to an external OpenAI-compatible Qwen2.5-VL server using optional `QWEN_VL_API_KEY` from `process.env`.
   - `comfyuiProxy.ts` & `comfyuiMonitor.ts`: Full REST/multipart/SSE-over-WebSocket proxy (`/api/comfyui/test`, `/models`, `/upload-image`, `/queue`, `/prompt`, `/history`, `/interrupt`, `/view`, `/events/:clientId`) with server-side `COMFYUI_API_TOKEN`.
   - `ffmpegService.ts`: Local `execFile`-only (`shell: false`) MP4 renderer supporting AAC audio muxing and UTF-8 `.srt` Unicode burn-in.

3. **Pure Domain Modules & Automated Tests**:
   - Unit tests exist in `src/modules/**` and `server/services/apiRoutes.test.ts` (13 passing tests covering LTX/Wan workflow constraints, prompt compilation, character heuristics, lyrics parsing, `.nss.zip` export/import, SSRF URL blocking, ComfyUI mocking, Qwen mocking, and FFmpeg MP4 rendering).

---

## 2. Identified Architectural Gaps vs. Master Prompt 03

1. **Tightly Coupled AI Provider Dispatch**:
   - `server/app.ts` and `src/services/api/studioApi.ts` expose separate bespoke routes (`/api/gemini/*`, `/api/vision/*`, `/api/comfyui/*`) with no unified **AI Provider Registry**, **Model Capability Matrix**, or **Task-Based Routing Engine**.
   - Commercial providers (`OpenAI`, `Anthropic Claude`) and self-hosted text/multimodal servers (`Ollama`, generic `OpenAI-compatible / vLLM` endpoints) have no adapter or health/model inspection route.
   - `ModelManagerView` lists only static Gemini/Qwen/LTX/Wan entries plus live ComfyUI checkpoints, without cost awareness metadata (`free_tier`, `paid_api`, `local_self_hosted`, user-configurable rates), quality tier tags, or capability flags (e.g., whether a model supports vision, structured JSON output, or Tigrigna).
   - No fallback transparency mechanism exists when switching from a primary provider to a secondary provider or offline simulation mode.

2. **Pre-Production & Film/Documentary Lifecycle Gap**:
   - `Project` begins directly at media ingestion, character entries, and a flat `ScenePlan[]` tailored mostly to music videos (`createBlankProject` and `demoProject.ts`).
   - Missing structured entities for:
     - **Creative Development**: concept, creative brief, logline, synopsis, treatment, theme, target audience, genre, production category (`music_video`, `short_film`, `documentary`, `commercial_ad`, `educational`, etc.), intended duration, visual direction, objectives.
     - **Screenplay & Script Studio**: structured screenplay scenes/sections (`actNumber`, `sequenceName`, `slugline`, `actionDescription`, `dialogueBlocks`, `narration`, `revision`, `approved`, `versionHistory`) traceable back to `ScenePlan` IDs (`linkedSceneId`).
     - **Pre-Production Bibles & Breakdowns**: Costume/Wardrobe Bible, Location Bible, Props & Set Design inventory, Scene Breakdown, Storyboard frames, and Shot List data structures.
     - **Unified Document Management**: Editable `ProductionDocument[]` artifacts with version history, status approvals (`draft`, `in_review`, `approved`), comments, entity links (`linkedSceneIds`, `linkedCharacterIds`), and exports (`Markdown`, `JSON`, printable `PDF`/`HTML`, and Word-compatible `.doc`).

3. **Multilingual & Tigrigna (`ትግርኛ`) Support**:
   - `lyricsParser.ts` detects Ethiopic Unicode script (`[\u1200-\u137F]`) strictly as `Amharic (አማርኛ)`, which misclassifies Tigrigna (`ትግርኛ`) text! Language selection, script/dialogue localization hints, Unicode NFC normalization, and honest TTS/STT compatibility declaration (especially warning that high-quality Tigrigna TTS is unverified until explicitly tested) need to be implemented cleanly.

4. **Production Continuity & Schema Migration**:
   - No `schemaVersion` field exists inside `Project` JSON (`PROJECT_ARCHIVE_SCHEMA_VERSION` was only stamped onto `manifest.json`), and legacy projects loaded from IndexedDB or older `.nss.zip` archives lack pre-production structures.
   - No continuity engine detects when editing a character, costume, or screenplay scene invalidates dependent scenes, prompts, or production documents without overwriting approved outputs.

---

## 3. Proposed Architecture & Phased Implementation Plan

1. **Backward-Compatible Project Schema v2.0.0 (`src/modules/persistence/projectMigration.ts`)**:
   - Add `schemaVersion: '2.0.0'` and non-destructive `migrateProjectSchema(rawProject)` executed automatically on IndexedDB load and `.nss.zip` import.
   - Preserve all existing v1 fields (`mediaAssets`, `analyses`, `characters`, `scenes`, `promptHistory`, `jobs`, `clips`, `musicAsset`, `lyrics`, `timeline`, `workflows`, `exportSettings`, `extraMetadata`) untouched while lazily initializing `creativeBrief`, `screenplay`, `productionDocuments`, `languageConfig`, `continuityAlerts`, and extended bibles (`costumes`, `locations`, `props`, `storyboards`, `shotList`, `breakdowns`).
   - Export sanitization helper guaranteeing zero API secrets or runtime credentials are ever serialized into IndexedDB, `localStorage`, client metadata, or `.nss.zip`.

2. **Phase A — Multi-Provider AI Orchestration & Secure Settings**:
   - Pure capability & routing engine in `src/modules/ai-orchestration/orchestratorRules.ts` with comprehensive `node:test` coverage.
   - Server-side multi-provider execution & probe service in `server/services/aiOrchestrator.ts` supporting:
     - `google-gemini` (env-only `GEMINI_API_KEY`, existing Gemini integration reused, zero browser key inputs)
     - `openai` (`OPENAI_API_KEY` env or ephemeral server-memory session credential, `/v1/models`, `/v1/chat/completions`)
     - `anthropic` (`ANTHROPIC_API_KEY` env or ephemeral server-memory session credential, `/v1/messages`)
     - `qwen-vl` (OpenAI-compatible VLM endpoint)
     - `ollama` (configurable base URL, `/api/tags`, `/api/chat`)
     - `openai-compatible` (vLLM / LM Studio / custom `/v1/models` + `/v1/chat/completions`)
     - `comfyui` (delegating to verified `comfyuiProxy.ts`)
   - Ephemeral server credential endpoints (`/api/providers/credentials`) returning **only** `{ hasCredential: boolean, source: 'env' | 'session_memory' | 'none' }` — never echoing secrets to the browser. Note explicitly in UI and docs that container runtime has no external encrypted KMS vault, so persistent keys belong in `.env` / server Secrets while UI-entered 3rd-party keys (OpenAI/Anthropic/custom non-Gemini) live strictly in server process memory.
   - New **AI Intelligence** navigation group (`AI Providers`, `Model Routing`, plus upgraded cost-aware `Model Registry / Manager`), linked directly from `Settings`.

3. **Phase B — Production Development Foundation, Document Manager, Tigrigna & Continuity**:
   - New **Production Development** navigation group preserving all 16 original views:
     - `Creative Development` (Idea-to-Creative-Brief, Logline, Synopsis, Treatment, Category, Duration, Visual Direction, plus optional routed AI drafting)
     - `Screenplay Studio` (Linked screenplay scenes traceable via `linkedSceneId`, multilingual dialogue including `Tigrigna (ትግርኛ)`, revisions, approvals, and `Sync Scene Title/Beat to Scene Planner`)
     - `Production Documents` (Unified Document Manager with Markdown, JSON, Printable PDF/HTML, Word `.doc` export, version snapshots, comments, and approvals)
     - `Continuity Dashboard` (Entity relationship scan flagging unreviewed script edits, character/reference mismatches, and missing storyboard/shot links without auto-overwriting approved clips/docs)
   - Extended `lyricsParser.ts` with Tigrigna recognition hints, explicit language tagging, and Unicode NFC normalization.

---

## 4. Compatibility & Honesty Commitments

- Zero API keys or GPU servers required to run Neural Symphony Studio (full manual editing + Offline Simulation + local FFmpeg + `.nss.zip` portability always available).
- No hardcoded or fabricated pricing; cost fields default to verified tier classification (`free_tier`, `paid_api`, `local_self_hosted`) with user-configurable rates.
- External providers without live credentials or reachable endpoints report exact honest status (`requires_credentials`, `requires_external_infrastructure`, `unavailable`) and never emit mock AI prose labeled as real model output.
