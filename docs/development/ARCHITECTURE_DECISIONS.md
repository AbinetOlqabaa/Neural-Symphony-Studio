# Architecture Decisions Log — Neural Symphony Studio

1. **ADR-001: External ComfyUI Companion Architecture**
   - *Decision*: Connect to ComfyUI over HTTP/WS via Express proxy routes (`server/services/comfyuiProxy.ts`) rather than attempting to embed Python/CUDA inside Node.js.
   - *Rationale*: Repository audit confirmed this is a Node/React workspace without ComfyUI Python source or GPU hardware.

2. **ADR-002: Server-Side AI Proxy (`/api/gemini/*` & `/api/vision/*`)**
   - *Decision*: Keep `@google/genai` SDK and `GEMINI_API_KEY` strictly inside `server/services/geminiService.ts`, and proxy external Qwen2.5-VL requests through `server.ts` with `validateExternalServiceUrl` SSRF checks.
   - *Rationale*: Prevents credential leakage to browser bundles and enforces safe URL validation.

3. **ADR-003: IndexedDB Primary Client Persistence + Portable `.nss.zip` Archives**
   - *Decision*: Store project JSON and media DataURLs in IndexedDB (`neural_symphony_studio_db`) and implement `jszip` archive export/import (`src/modules/persistence/projectArchive.ts`).
   - *Rationale*: Avoids `localStorage` 5MB quota limits while enabling full cross-account portability.

4. **ADR-004: Honest Simulation vs Live Backend Separation**
   - *Decision*: Label demo project assets as `Demo Data`, mark disconnected hardware stats as `Not available`, and explicitly separate `Generate via ComfyUI` from `Run Offline Simulation Test`.
   - *Rationale*: Ensures creators never mistake offline test runs or unavailable GPUs for real backend execution.
