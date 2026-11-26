# AGENTS.md — Permanent Instructions for AI Agents

This repository hosts **Neural Symphony Studio**, an AI-powered image-to-video music video production platform designed to pair with an external ComfyUI generation backend.

## Mandatory Continuity Protocol

When starting a session (especially under `RESUME NEURAL SYMPHONY DEVELOPMENT`):

1. Read `AGENTS.md` (this file).
2. Read `docs/handoff/NEXT_ACCOUNT_START_HERE.md`.
3. Read `docs/development/PROJECT_STATE.md`, `docs/development/IMPLEMENTATION_ROADMAP.md`, `docs/development/KNOWN_ISSUES.md`, and `docs/development/TEST_REPORT.md`.
4. Verify claims against actual source code in `src/` and `server/` before modifying files.
5. Never delete working features or rewrite architecture without documenting the decision in `docs/development/ARCHITECTURE_DECISIONS.md`.

## Non-Negotiable Engineering Rules

- **Security**: Never expose `GEMINI_API_KEY`, third-party provider keys, or backend credentials in `src/` client code, IndexedDB, `localStorage`, or `.nss.zip` exports. All `@google/genai`, OpenAI/Anthropic/Ollama/OpenAI-compatible orchestration, ComfyUI, Qwen2.5-VL, and FFmpeg proxy requests go through `server.ts` (`/api/*`). Never create UI inputs for Gemini API keys.
- **Honesty**: Never fabricate GPU telemetry, ComfyUI connection status, installed model lists, model pricing, or automated video quality scores. Display `"Not available"` when hardware diagnostics are absent, mark unverified provider states accurately, never claim unverified Tigrigna TTS support, and explicitly label offline test/simulation runs.
- **Portability**: Every project must remain exportable/importable as a self-contained `.zip` archive (`schemaVersion: "2.1.0"` with backward compatibility for v1 and `"2.0.0"`) via `migrateProjectSchema`, preserved unknown `extraMetadata`, `manifest.json`, media assets, creative brief, screenplay, Phase C pre-production bibles/storyboards/shots/schedule, and production documents—and zero exported secrets.
- **Pure Logic & Testing**: Keep domain rules (AI provider/routing rules, production document lifecycle, Phase C pre-production engine, project schema migration, continuity impact analysis, LTX-Video frame constraints, prompt compilation, workflow validation, timeline/lyric sync math including Tigrigna `ትግርኛ`) decoupled in `src/modules/` with `*.test.ts` unit tests runnable via `npx --yes tsx --test`.
- **UI Discipline**: Preserve all 16 original studio navigation sections alongside Production Development (`Creative Development`, `Screenplay Studio`, `Production Documents`, `Continuity Dashboard`), Visual Pre-Production (`Scene Breakdown`, `Character Bible`, `Costume Bible`, `Location Bible`, `Props & Set Design`, `Storyboard Studio`, `Shot List`, `Production Schedule`), and AI Intelligence (`AI Providers`, `Model Routing`) sections (**29 total views**), dark-first studio theme with working light/dark variables, zero-pill metadata (`·` separators), tabular numerals (`tabular-nums`), and accessible native HTML controls.

## Handoff Commands

If the user says `HANDOFF NOW`, `PREPARE NEXT ACCOUNT`, `SAVE DEVELOPMENT STATE`, or `EXPORT CONTINUATION PACKAGE`:
1. Stop implementing new features.
2. Run `npm run lint`, `npm run build`, and `npx --yes tsx --test src/**/*.test.ts`.
3. Update `PROJECT_STATE.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`, `TEST_REPORT.md`, `NEXT_ACCOUNT_START_HERE.md`, and `HANDOFF_MANIFEST.json`.
4. Instruct the user to use Google AI Studio's project download/export feature (excluding `node_modules` and secrets).
