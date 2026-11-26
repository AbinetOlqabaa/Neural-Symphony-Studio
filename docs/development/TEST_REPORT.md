# Test Report — Neural Symphony Studio

**Last Test Run:** 2026-11-26  

## 1. Tests Executed & Passed

### TypeScript & Build Verification
- `npm run lint` (`tsc --noEmit`): **PASSED** (0 errors).
- `compile_applet` (`vite build`): **PASSED**.

### Automated Unit & Integration Tests (`npx --yes tsx --test src/modules/**/*.test.ts server/services/*.test.ts`) — 28/28 Passed
- `server/services/apiRoutes.test.ts`: **PASSED** (SSRF blocking, mocked ComfyUI E2E, mocked Qwen2.5-VL, real local FFmpeg MP4 render with Unicode SRT burn-in, server credential isolation & mocked OpenAI fallback).
- `src/modules/ai-orchestration/orchestratorRules.test.ts`: **4/4 PASSED**.
- `src/modules/production/preProductionEngine.test.ts`: **5/5 PASSED** (Character Bible normalization/snapshot/revert, storyboard reordering + shot conversion, deterministic screenplay breakdown extraction + non-destructive apply, safe deletion cleanup across foreign keys, CSV/JSON/MD/HTML Shot List & Contact Sheet exports).
- `src/modules/production/preProductionIntegration.test.ts`: **1/1 PASSED (Miniature Production E2E)** — creates 3 multilingual screenplay scenes (`English`, `Amharic`, `Tigrigna`, `Afaan Oromoo`), 2 characters, 2 costumes, 2 locations, 3 props (with multi-scene state transitions), scene breakdowns, reordered storyboards, shots, pre/prod/post tasks with dependencies, continuity scan (`critical`/`warning`/`informational` + preserved `intentionalDifference` notes), all 9 Markdown renderers, Shot List/Contact Sheet exports, and `.nss.zip` export/import roundtrip stripping secret-like keys.
- `src/modules/continuity/continuityEngine.test.ts`: **1/1 PASSED** (missing character/reference/costume/location, time-of-day transitions, broken storyboard/shot links, prop location/state shifts, unreviewed screenplay edits, manual alert preservation).
- `src/modules/production/documentSystem.test.ts`: **2/2 PASSED**.
- `src/modules/persistence/projectMigration.test.ts`: **2/2 PASSED** (`v1`/`v2.0.0` -> `v2.1.0` migration + secret stripping).
- `src/modules/persistence/projectArchive.test.ts`: **1/1 PASSED**.
- `src/modules/generation-engine/engineRules.test.ts`: **7/7 PASSED**.
- `src/modules/prompt-engineering/promptCompiler.test.ts`: **1/1 PASSED**.
- `src/modules/character-intelligence/characterMatcher.test.ts`: **2/2 PASSED**.
- `src/modules/music/lyricsParser.test.ts`: **1/1 PASSED**.

### Browser Verification (Headless Chromium via `playwright-cli`)
- **Round 1 Desktop (`1440x900`) & Mobile (`390x844`)**: Verified all 8 Visual Pre-Production workspaces + Continuity Dashboard (incl. `Mark Intentional`) + Production Documents + Generation/Timeline/Music with 0 console/page errors and `overflow: false`. Caught and fixed mobile `<select>` width overflow in `SceneBreakdownView` and chronological scene sorting in `StoryboardStudioView`.
- **Round 2 Desktop & Mobile (`1440x900`, `390x844`)**: Verified `Frame 1 — Shot 1A` chronological ordering, created a new Production Schedule task and confirmed IndexedDB persistence across `page.reload()` (`persistedCount: 5`), and confirmed `mobileOverflow: false` with bounded `328px` select in `SceneBreakdownView` (0 console/page errors).

## 2. Tests Requiring External Infrastructure
- Live ComfyUI GPU execution, live Qwen2.5-VL host, live third-party commercial/local LLM keys, live flux/SDXL storyboard image endpoint, and live Tigrigna TTS voice synthesis (not present inside container).
