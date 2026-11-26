# Technology Decisions — Neural Symphony Studio

| Layer | Choice | Rationale |
| :--- | :--- | :--- |
| Frontend Framework | React 19 + TypeScript + Vite 8 | Pre-installed in AI Studio container; strict typing, fast compilation, modular component architecture. |
| Styling System | Tailwind CSS v4 (`@tailwindcss/vite`) + CSS Design Tokens | Supports `@custom-variant dark` dual-theme architecture without brittle overrides; crisp studio layout. |
| Typography | `Plus Jakarta Sans` + `DM Sans` + `JetBrains Mono` | Clean studio hierarchy with mandatory tabular numerals for timestamps, frame counts, and JSON diagnostics. |
| Icons | `lucide-react` | Already installed; consistent stroke geometry across all 16 studio views. |
| Backend Server | Node.js + Express (`server.ts` via `tsx`) | Hosts `vite.middlewares` on port 3000 and keeps `GEMINI_API_KEY` and external backend credentials strictly server-side. |
| Client Persistence | IndexedDB (native wrapper, zero extra DB deps) | Stores large binary image/audio/video blobs + structured JSON project state across browser reloads without hitting 5MB `localStorage` limits. |
| Archive Portability | `jszip` | Enables real client & server `.zip` extraction during media upload and complete portable `.zip` project export/import. |
| AI SDK | `@google/genai` (server-side only) | Powers Gemini multimodal image analysis, scene planning, and prompt synthesis via `/api/gemini/*`. |
| Unit Testing | `node:test` + `node:assert/strict` via `npx tsx --test` | Zero extra test framework dependencies; fast deterministic verification of pure logic modules. |
