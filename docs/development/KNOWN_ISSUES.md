# Known Issues & Pending Integrations — Neural Symphony Studio

1. **Physical External ComfyUI GPU Verification Pending**
   - **Description**: All ComfyUI endpoints (`/system_stats`, `/object_info`, `/upload/image`, `/prompt`, `/history`, `/view`, `/ws` SSE bridge) are implemented and verified against an automated mock ComfyUI HTTP server. Live LTX-Video 0.9.5 / Wan 2.1 generation awaits pairing with an external GPU ComfyUI host (`--listen`).
   - **Affected Files**: `server/services/comfyuiProxy.ts`, `server/services/comfyuiMonitor.ts`.
   - **Severity**: Medium (external GPU required).

2. **External Qwen2.5-VL Inference Host Verification Pending**
   - **Description**: `/api/vision/test` and `/api/vision/analyze` pass against a local mock server; no live Qwen2.5-VL GPU host runs in the preview container.
   - **Affected Files**: `server/services/qwenService.ts`.
   - **Severity**: Low.

3. **Direct Storyboard Still Image Render Endpoint**
   - **Description**: `StoryboardStudioView` supports `Text-Only` and `Reference Image` modes completely offline. Clicking **Generate Frame Image** in `ai_generated` mode evaluates capability routing cleanly and records an honest `'failed'` explanation until a live flux/SDXL or server image-render endpoint is attached (never emits synthetic placeholder artwork).
   - **Affected Files**: `src/components/preproduction/StoryboardAndShotViews.tsx`.
   - **Severity**: Low.

4. **External Multi-Provider Live Verification & Tigrigna (`ትግርኛ`) TTS**
   - **Description**: Multi-provider routing (`OpenAI`, `Anthropic`, `Ollama`, custom endpoints) is verified against a mock OpenAI server; live external keys/hosts are optional. Tigrigna Unicode (`U+1200–U+137F`), NFC normalization, scripts, and `.SRT` subtitles work offline; `tts_narration` remains honestly marked unverified until a Tigrigna-capable TTS backend is configured.
   - **Affected Files**: `server/services/aiOrchestrator.ts`, `src/modules/ai-orchestration/orchestratorRules.ts`.
   - **Severity**: Medium.
