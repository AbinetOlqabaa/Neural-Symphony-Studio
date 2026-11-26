# LTX-Video 0.9.5 & Wan 2.1 ComfyUI Integration Architecture

**Last Updated:** 2026-11-26

---

## 1. Execution Lifecycle (Express Secure Proxy + Live Monitoring)

Neural Symphony Studio communicates with an external ComfyUI GPU backend (local machine, Google Colab tunnel, or remote GPU instance) exclusively through the Express companion server (`server/app.ts`) so browser code never exposes private authentication tokens (`COMFYUI_API_TOKEN`):

1. **URL & SSRF Validation (`server/services/urlGuard.ts`)**: Rejects non-HTTP(S) schemes, rejects embedded credentials (`user:pass@`), and blocks cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`, `100.100.100.200`).
2. **Connection Probe & Capability Inspection (`POST /api/comfyui/test`, `POST /api/comfyui/models`)**:
   - Classifies backend state cleanly into `connected`, `disconnected`, `connecting`, `authentication_required`, `unreachable`, `configuration_invalid`, or `unknown`.
   - Fetches `/object_info` and inspects node classes (`nodeTypes`), `checkpoints`, and `unets`.
3. **Reference Frame Upload (`POST /api/comfyui/upload-image`)**:
   - Before submitting an image-to-video graph containing a `LoadImage` node, reference frame bytes are uploaded via `multipart/form-data` to ComfyUI `POST /upload/image`.
   - The returned `{ name, subfolder }` is injected directly into `LoadImage.inputs.image`.
4. **Parameter & Format Validation (`src/modules/generation-engine/engineRules.ts`)**:
   - Explicitly rejects ComfyUI Editor UI-format JSON (`nodes`/`links`) and guides users to export via `Save (API Format)`.
   - Snaps LTX-Video 0.9.5 parameters (`8n + 1` frame counts, 32px dimensions) and Wan 2.1 parameters (`4n + 1` frame counts, 16px dimensions).
   - Injects `CLIPTextEncode`, `KSampler` / `SamplerCustom`, `LTXVImgToVideo`, `LTXVConditioning`, `LTXVScheduler`, `WanImageToVideo`, `VHS_VideoCombine`, `SaveAnimatedWEBP`, `SaveVideo`, and `LoadImage` parameters non-destructively.
5. **Live WebSocket Progress & Output Retrieval**:
   - `server/services/comfyuiMonitor.ts` opens `/ws?clientId=...` on the ComfyUI server and streams structured `ComfyExecutionEvent` updates to the browser via Server-Sent Events (`GET /api/comfyui/events/:clientId`), backed by periodic `POST /api/comfyui/history` checks.
   - Completed output videos and frames are streamed through `GET /api/comfyui/view` without leaking `COMFYUI_API_TOKEN` to the browser and attached as a new versioned `VideoClip` on the originating scene.

---

## 2. Engine Adapter Matrix

| Engine | Target Model | Frame Rule | Dimension Grid | Required ComfyUI Nodes |
|---|---|---|---|---|
| `ltx-video` | `Lightricks/LTX-Video-0.9.5` | `8n + 1` (e.g., 97, 121) | `32px` | `CheckpointLoaderSimple`, `LTXVImgToVideo`, `LTXVConditioning` (optional), `KSampler`/`SamplerCustom`, `VHS_VideoCombine`/`SaveVideo` |
| `wan-2.1` | `Wan2.1-I2V-14B-480P` | `4n + 1` (e.g., 49, 81) | `16px` | `UNETLoader`/`CheckpointLoaderSimple`, `WanImageToVideo`, `KSampler`, `VHS_VideoCombine`/`SaveVideo` |
| `comfyui` | Custom API Workflow | `any` | `8px` | User-supplied API graph nodes (`SaveImage` or video output node) |

---

## 3. Colab / Remote Tunnel Notes

- Launch ComfyUI with `--listen 0.0.0.0 --port 8188 --enable-cors-header` (or behind an HTTPS reverse proxy/tunnel).
- If protected by Bearer authentication, set `COMFYUI_API_TOKEN` in the Studio server `.env` (never in browser `Settings`).
- Use **System Monitor -> Run ComfyUI E2E Test** to run a fast 256x256 4-step checkpoint verification before queuing full video jobs.
