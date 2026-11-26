# Project State — Neural Symphony Studio

**Last Updated:** 2026-11-26  
**Project Identity:** Neural Symphony Studio (`0513498f-0745-41e6-9ee0-5206fd538eed`)

## 1. Project Purpose

AI-powered film, documentary, commercial, and music video production platform transforming briefs, screenplays, character/wardrobe/location/prop bibles, storyboards, shot lists, reference photographs, music tracks, and multilingual lyrics (`English`, `Amharic`, `Tigrigna`, `Afaan Oromoo`) into synchronized audiovisual productions paired with ComfyUI and server-side FFmpeg rendering.

## 2. Current Architecture

- **Frontend (`src/`)**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4, dark-first studio theme with light/dark variables, **29-section** sidebar shell (all 16 original views + 4 Production Development views + **8 Visual Pre-Production workspaces** + 2 AI Orchestration views, consolidated with `Character Bible` in Visual Pre-Production), IndexedDB persistence (`neural_symphony_studio_db`), schema `v2.1.0` migration, and live SSE ComfyUI job tracking.
- **Visual Pre-Production Studio (`src/components/preproduction/`, `src/components/characters/`)**:
  - `SceneBreakdownView`: Non-destructive deterministic extraction + routed AI breakdown assist from Screenplay Studio + single-scene AI Review Scene Prep.
  - `CharactersView` (**Character Bible Studio**): Tabs for Identity, Development & Arc, Visual Identity, multi-angle References & Prompt, and non-destructive version snapshots/revert + AI Draft Suggestions.
  - `CostumeBibleView`, `LocationBibleView`, `PropsSetDesignView`: Linked wardrobe, locations (`real_world | studio | fictional | ai_generated`), and props with scene-by-scene state progression (`PropSceneState`) and safe delete cleanup.
  - `StoryboardStudioView`: `text_only`, `reference_image`, and capability-checked `ai_generated` frames (honest `planned | requested | generating | generated | failed` state without placeholder fabrication), reordering, `Create Shot`, and HTML/Markdown contact sheet export.
  - `ShotListView`: Dense cinematography table + inspector with `datalist` standard/custom shot size, angle, movement, lens, crew, audio, and CSV/JSON/Markdown/Printable HTML exports.
  - `ProductionScheduleView`: Pre-Production / Production / Post-Production milestones with dependencies across List, Board (Kanban), Calendar, and Timeline (Gantt) views.
- **Backend (`server.ts`, `server/app.ts`, `server/services/`)**: `urlGuard.ts`, `aiOrchestrator.ts`, `comfyuiProxy.ts`, `comfyuiMonitor.ts`, `qwenService.ts`, `geminiService.ts`, and `ffmpegService.ts` (`execFile`-only sandboxed MP4 assembly + SRT burn-in).
- **Pure Logic Modules (`src/modules/`)**: `preProductionEngine.ts`, `continuityEngine.ts` (8 cross-bible rules + `intentionalDifference` preservation), `documentSystem.ts` (11 structured doc types including `production_schedule` and `preproduction_package`), `projectMigration.ts` (`v2.1.0`), `projectArchive.ts`, `orchestratorRules.ts`, `engineRules.ts`, `promptCompiler.ts`, `characterMatcher.ts`, `lyricsParser.ts`.

## 3. Phase Status

- **Phases 0–2 & Integration Hardening (Milestone 02)**: Completed & verified (local FFmpeg MP4 render verified; live ComfyUI/Qwen awaiting external GPU endpoints).
- **Prompt 03 — Phases A & B**: Completed & verified.
- **Prompt 04 — Phase C (Visual Pre-Production & Production Planning)**: **Implemented & Verified** via 28/28 automated unit + miniature production E2E tests and headless Chromium desktop/mobile inspection.
- **Prompt 03/04 Remaining Optional Expansions**: Dedicated standalone AI Production Assistant chat/ledger workspace and live external infrastructure verification (ComfyUI flux/SDXL storyboard image endpoint, external GPU Qwen2.5-VL, live 3P LLM keys, verified Tigrigna TTS).
