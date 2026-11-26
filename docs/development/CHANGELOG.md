# Changelog — Neural Symphony Studio

## 2026-11-26 — Visual Pre-Production & Production Planning (Prompt 04: Phase C)

### Files Created
- `src/modules/production/preProductionEngine.ts` & `src/modules/production/preProductionEngine.test.ts`
- `src/modules/production/preProductionIntegration.test.ts`
- `src/components/preproduction/WardrobeLocationPropsViews.tsx`
- `src/components/preproduction/SceneBreakdownView.tsx`
- `src/components/preproduction/StoryboardAndShotViews.tsx`
- `src/components/preproduction/ProductionScheduleView.tsx`

### Files Modified
- `src/types/studio.ts`, `src/modules/persistence/projectMigration.ts` (`v2.1.0`), `src/modules/persistence/projectArchive.ts`
- `src/modules/production/documentSystem.ts`, `src/modules/continuity/continuityEngine.ts`, `src/modules/continuity/continuityEngine.test.ts`
- `src/data/demoProject.ts`, `src/hooks/useStudioStore.ts`
- `src/components/characters/IntelligenceAndCharactersViews.tsx` (Character Bible Studio 5-tab + version history)
- `src/components/production/ProductionDevelopmentViews.tsx` (Continuity filters, `Open Record` jump, `Mark Intentional` explanations, Schedule/Package doc types)
- `src/components/layout/StudioShell.tsx`, `src/App.tsx`

### Summary of Changes
- Added all 8 connected Visual Pre-Production workspaces (`Scene Breakdown`, `Character Bible`, `Costume Bible`, `Location Bible`, `Props & Set Design`, `Storyboard Studio`, `Shot List`, `Production Schedule`) while preserving all 16 original studio views and Phase A/B workspaces.
- Expanded `continuityEngine.ts` to 8 cross-entity rules with `critical | warning | informational` classification, section jump links, and persistent `intentionalDifference` explanations.
- Upgraded `.nss.zip` archives (`schemaVersion: "2.1.0"`) with `costumes.json`, `locations.json`, `props.json`, `storyboard.json`, `shot_list.json`, and `production_schedule.json`.

---

## 2026-11-26 — Production Intelligence & AI Model Orchestration (Prompt 03: Phases A & B)
- Implemented AI Provider Registry, Task-Based Model Routing, Creative Development, Screenplay Studio, Production Document Manager, Continuity Dashboard foundation, and Tigrigna (`ትግርኛ`) Unicode/LRC/SRT support.

## 2026-11-26 — Integration Hardening & Initial Full-Stack Build
- Implemented React 19 + Vite + Express companion backend, IndexedDB + `.nss.zip`, LTX-Video 0.9.5 & Wan 2.1 ComfyUI adapters, Qwen2.5-VL proxy, and sandboxed local FFmpeg MP4 rendering.
