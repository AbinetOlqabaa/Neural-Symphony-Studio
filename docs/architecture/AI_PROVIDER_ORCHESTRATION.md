# AI Provider Orchestration Architecture — Neural Symphony Studio

**Last Updated:** 2026-11-26  
**Status:** Phase A Implemented & Verified with Unit/Mock Server Tests (Live External Providers Optional)

---

## 1. Architectural Principles

1. **Provider-Agnostic Orchestration**: Domain workflows (`creative_development`, `screenplay_writing`, `production_breakdown`, `character_design`, `prompt_engineering`, `vision_analysis`, `image_generation`, `video_generation`, `multilingual_translation`, `tts_narration`) are decoupled from concrete vendors via `OrchestrationTaskType` and `TaskRoutingRule` (`src/types/studio.ts`, `src/modules/ai-orchestration/orchestratorRules.ts`).
2. **Strict Server-Side Credential Isolation**:
   - `GEMINI_API_KEY` is read exclusively from `process.env.GEMINI_API_KEY` inside `server/services/geminiService.ts`. No UI input exists for Gemini API keys, and `/api/providers/:id/credentials` explicitly rejects `google-gemini` with HTTP `400`.
   - Optional third-party API credentials (`openai`, `anthropic`, `qwen-vl`, `openai-compatible`, `comfyui`) can be provided via `.env` / server secrets or entered for the running session via `POST /api/providers/:id/credentials`.
   - Session credentials are stored strictly in ephemeral Node.js process RAM (`sessionCredentials` Map inside `server/services/aiOrchestrator.ts`)—never echoed back to the browser (`GET /api/providers/credentials` returns only `{ hasCredential, source }`), never stored in IndexedDB or `localStorage`, and never exported into `.nss.zip` archives (`sanitizeSettingsForClientExport`, `sanitizeProjectForPortableExport`).
3. **SSRF & Network Hardening**:
   - Every external provider base URL (OpenAI-compatible, Qwen2.5-VL, Ollama, ComfyUI) passes `validateExternalServiceUrl` (`server/services/urlGuard.ts`) before any HTTP request is dispatched, blocking non-HTTP(S) schemes, embedded `user:pass@` URL credentials, and cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`, `100.100.100.200`, `0.0.0.0`, `::`).
4. **Honest Status & Fallback Transparency**:
   - `evaluateProviderStatus` classifies providers into 7 explicit states: `connected`, `configured`, `requires_credentials`, `requires_external_infrastructure`, `unavailable`, `offline_simulation`, and `disabled`.
   - `resolveTaskRoute` validates capability compatibility (`supportsVision`, `supportsText`, `supportsVideo`, `supportsVoice`, `supportsTigrigna`, `supportsStructuredJson`) before dispatching. For example, `tts_narration` in `Tigrigna (ትግርኛ)` is honestly flagged as `unverified` (`qualityNote`) rather than pretending a generic model supports native Tigrigna voice synthesis.
   - When a primary provider is unavailable or unconfigured and a secondary provider succeeds, `ExecutionResult` returns explicit `fallbackUsed: true`, `fallbackReason`, `attemptedProviders`, and `simulationMode` flags so the user never confuses fallback or offline simulation with primary model output.

---

## 2. Module & API Inventory

### Pure Domain Rules (`src/modules/ai-orchestration/orchestratorRules.ts`)
- `createDefaultProviders()`: Initializes `google-gemini`, `openai`, `anthropic`, `qwen-vl`, `ollama`, `openai-compatible`, and `comfyui`.
- `createDefaultModels()`: Initializes model capability and cost registry records (`free_tier`, `paid_api`, `local_self_hosted`) without fabricated per-token prices (`currency: 'USD'`, user-configurable rates).
- `createDefaultRoutingRules()`: Maps every `OrchestrationTaskType` to primary + fallback providers/models and priority (`quality`, `cost`, `speed`, `local`).
- `evaluateProviderStatus()`: Derives truthful UI status from enabled state, server credential presence, and live test state.
- `resolveTaskRoute()`: Selects eligible models/providers matching task capability and priority preference, recording fallback reasons.
- `sanitizeSettingsForClientExport()`: Strips `apiKey`, `apiToken`, `token`, `secret`, `password`, and `authorization` keys before saving client state or exporting archives.

### Express Orchestration Service (`server/services/aiOrchestrator.ts` & `server/app.ts`)
- `GET /api/providers/credentials` — Returns sanitized `{ hasCredential, source }` map for all providers.
- `POST /api/providers/credentials/status` — Accepts custom provider IDs and returns credential presence flags without returning secrets.
- `POST /api/providers/:id/credentials` — Stores or clears an optional non-Gemini session credential in server process memory.
- `POST /api/providers/test` — Executes safe probe checks against Gemini env config, OpenAI `/v1/models`, Anthropic env/session status, Ollama `/api/tags`, Qwen `/v1/models`, ComfyUI `/system_stats`, or custom OpenAI-compatible endpoints.
- `POST /api/orchestration/execute` — Executes text/structured/translation orchestration tasks across primary -> secondary fallback chain with timeout, retry, and fallback logging.

---

## 3. Cost & Capability Governance

- **No Invented Pricing**: Built-in models declare `costTier` (`free_tier`, `paid_api`, `local_self_hosted`) and leave numerical token/image/video rates empty (`undefined`) unless explicitly entered by the user in **Model Manager** (`verifiedSource` + `lastVerifiedDate`).
- **Offline Development Guarantee**: The entire creative studio, document manager, project persistence, `.nss.zip` portability, offline simulation mode, and local FFmpeg MP4 renderer remain functional with zero paid keys or external GPU servers configured.
