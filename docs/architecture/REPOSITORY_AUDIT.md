# Repository Audit — Neural Symphony Studio

**Audit Date:** 2026-11-26  
**Audited Environment:** Google AI Studio Build Workspace (`/app/applet`)  
**Phase:** Phase 0 — Repository Discovery

---

## 1. Actual Repository Contents Discovered

Inspection of the workspace root `/` revealed a clean Google AI Studio full-stack starter template rather than a bundled ComfyUI Python repository:

- `package.json`: React `19.0.1`, Vite `8.3.0`, `@tailwindcss/vite` `4.3.3`, `lucide-react` `0.546.0`, `motion` `12.23.24`, `express` `4.21.2`, `dotenv` `17.2.3`, `@google/genai`, `tsx` `4.21.0`, `typescript` `7.0.2`.
- `index.html`, `vite.config.ts`, `tsconfig.json`, `metadata.json`, `.env.example`, `.gitignore`.
- `src/`: Minimal entry (`main.tsx`, `App.tsx`, `index.css`).
- `public/`: Contains attached prompt reference file under `public/assets/aistudio/`.
- **ComfyUI Python Source**: Not present in this repository. No upstream `ComfyUI/` directory, Python `server.py`, `execution.py`, `nodes.py`, or `LICENSE` file exists locally.

---

## 2. Google AI Studio Runtime Assessment

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 runs natively in the container on port `3000`.
- **Backend**: Node.js + Express (`server.ts` executed via `tsx`) can run side-by-side with `vite.middlewares` on port `3000`, providing secure server-side routes (`/api/*`) for Gemini API calls, ComfyUI proxy requests, ZIP archive processing, and project persistence/export.
- **GPU & Python Limitations**: The Google AI Studio container does not provide an NVIDIA CUDA GPU or Python ComfyUI runtime. Attempting to embed ComfyUI's Python engine inside Node.js is unsupported and architecturally unsound.

---

## 3. ComfyUI Integration Architecture & Licensing Conclusion

Because ComfyUI is not bundled in this repository and requires an external GPU runtime (e.g., Google Colab GPU, local NVIDIA workstation, or dedicated GPU cloud server):

1. **Companion Application Architecture**: Neural Symphony Studio operates as an independent creative studio web application (React + Express) that communicates with an external, user-configured ComfyUI server over HTTP/HTTPS and WebSockets.
2. **Official ComfyUI API Integration**:
   - `GET /system_stats` — Backend reachability, Python/PyTorch/VRAM diagnostics (when available).
   - `GET /object_info` — Installed node classes and available models/checkpoints/LoRAs.
   - `POST /upload/image` — Uploading reference frames to ComfyUI's `input/` directory.
   - `POST /prompt` — Submitting validated workflow API JSON graphs with a `client_id`.
   - `GET /queue` & `POST /queue` — Inspecting and managing pending/running/cancelled queue items.
   - `GET /history` & `GET /history/{prompt_id}` — Retrieving execution outputs and filenames.
   - `GET /view` — Streaming generated video/image outputs back through our server proxy.
   - `WS /ws?clientId=...` — Live execution progress and node status updates.
3. **GPL-3.0 Attribution & Boundaries**: ComfyUI is an independent upstream project licensed under GPL-3.0. Neural Symphony Studio does not modify, fork, or redistribute ComfyUI's Python source code; it interacts strictly across ComfyUI's public HTTP/WebSocket API boundary.
4. **Honesty & Graceful Disconnection**: When no ComfyUI server is reachable, the UI must explicitly report `Disconnected` / `Not available` for GPU hardware telemetry and offer a clearly labeled **Simulation / Offline Mode** for workflow planning and testing without fabricating real GPU metrics.
