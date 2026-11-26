# Agent Instructions — Resuming Neural Symphony Studio

Follow this exact sequence whenever resuming work under `RESUME NEURAL SYMPHONY DEVELOPMENT`:

1. Read `/AGENTS.md` and `/docs/handoff/NEXT_ACCOUNT_START_HERE.md`.
2. Inspect `/docs/development/PROJECT_STATE.md`, `/docs/development/KNOWN_ISSUES.md`, and `/docs/development/TEST_REPORT.md`.
3. Run the unit tests and `npm run lint` to confirm baseline health before editing files:
   - `npx --yes tsx --test src/modules/generation-engine/engineRules.test.ts src/modules/prompt-engineering/promptCompiler.test.ts src/modules/character-intelligence/characterMatcher.test.ts src/modules/music/lyricsParser.test.ts src/modules/persistence/projectArchive.test.ts`
   - `npm run lint`
4. Preserve all existing 16 navigation views, IndexedDB persistence, portable `.nss.zip` archive compatibility, and honest status reporting (`"Not available"` when disconnected).
5. Never expose `GEMINI_API_KEY` or backend credentials in `src/`.
6. Update `CHANGELOG.md`, `TEST_REPORT.md`, `PROJECT_STATE.md`, and `NEXT_ACCOUNT_START_HERE.md` after every major change.
