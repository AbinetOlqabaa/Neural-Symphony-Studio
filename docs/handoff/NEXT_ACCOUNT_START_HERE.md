# Next Account Start Here — Handoff Package

## 1. Project Identity
- **Name**: Neural Symphony Studio
- **Purpose**: End-to-end AI-assisted pre-production, script-to-shot planning, multilingual (`English`, `Amharic`, `Tigrigna`, `Afaan Oromoo`) audiovisual workspace, ComfyUI image-to-video generation, and server-side FFmpeg MP4 rendering platform.

## 2. Current Project Architecture
- **Frontend**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (`src/App.tsx`, `src/hooks/useStudioStore.ts`, **29** domain views across Workspace, Production Development, Visual Pre-Production, Intelligence & Plan, Production, and AI Intelligence & Backend).
- **Backend**: Express + TypeScript (`server.ts` -> `server/app.ts`) hosting `/api/health`, `/api/gemini/*`, `/api/providers/*`, `/api/orchestration/execute`, `/api/vision/{test,analyze}`, `/api/comfyui/*`, and `/api/render/*`.
- **Persistence**: IndexedDB (`src/services/storage/indexedDbStore.ts`) with automatic backward-compatible `v2.1.0` migration (`src/modules/persistence/projectMigration.ts`) + portable `.nss.zip` archives (`src/modules/persistence/projectArchive.ts`).

## 3. Most Recently Completed Task
- Completed **Master Development Prompt 04 — Phase C (Visual Pre-Production and Production Planning)**:
  - Implemented Scene Breakdown Studio, 5-tab Character Bible Studio (with version snapshots & revert), Costume Bible, Location Bible, Props & Set Design (with scene state progression), Storyboard Studio (`text_only` / `reference_image` / capability-checked `ai_generated` + HTML/MD contact sheets), Shot List (`CSV`/`JSON`/`MD`/`HTML`), Production Schedule (List/Board/Calendar/Timeline + dependencies), and expanded 8-rule Continuity Dashboard (`Open Record` + `Mark Intentional` explanation tracking).
  - Verified with 28/28 unit + miniature E2E integration tests, `tsc --noEmit`, `vite build`, and headless Chromium desktop/mobile inspection (including IndexedDB reload persistence).

## 4. Current Unfinished / External Tasks
1. **External GPU & Endpoint Verification**: Pair with a live external ComfyUI GPU workstation (`--listen`), external Qwen2.5-VL host, live third-party LLM providers, or a live flux/SDXL storyboard image endpoint when available.
2. **Tigrigna (`ትግርኛ`) Voice/TTS Verification**: Wire an external Tigrigna-capable TTS provider before enabling `tts_narration` routing.

## 5. Last Successful Tests
- `npx --yes tsx --test src/modules/**/*.test.ts server/services/*.test.ts` -> **28/28 passed**.
- `npm run lint` (`tsc --noEmit`) -> **0 errors**.
- `compile_applet` (`vite build`) -> **Succeeded**.

## 6. Required Next Actions
1. Read `AGENTS.md`, `docs/development/PROJECT_STATE.md`, `docs/development/KNOWN_ISSUES.md`, and `docs/development/TEST_REPORT.md`.
2. Verify external GPU / endpoint integrations when hardware is connected, or proceed with post-Phase-C audio/voice or assistant enhancements.
