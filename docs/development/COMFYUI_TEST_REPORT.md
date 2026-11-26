# ComfyUI & Rendering Verification Report

**Date:** 2026-11-26  
**Environment:** Studio Web + Express Companion Server (No External GPU Server Attached)

---

## 1. Honest Execution Scope

- **External GPU / Live ComfyUI Server**: Not attached in this cloud preview container (`http://127.0.0.1:8188` returns `Unreachable (ECONNREFUSED)`). Live GPU inference with real LTX-Video 0.9.5 / Wan 2.1 weights and external Qwen2.5-VL endpoints awaits pairing with the user's Colab/local GPU server.
- **Mocked HTTP ComfyUI & Qwen E2E Verification (`server/services/apiRoutes.test.ts`)**: Verified passing against real Express routes + ephemeral local mock HTTP servers.
- **Real Local FFmpeg MP4 Rendering**: Verified passing using the container's installed FFmpeg 4.4.2 binary (`libx264` + `libass`), both in automated tests and directly in headless Chromium via Export Center UI.

---

## 2. Verified Capabilities

| Check | Mode | Result | Notes |
|---|---|---|---|
| SSRF URL Guard & Userinfo Rejection | Unit / API Test | PASS | Blocks `169.254.169.254` & `user:secret@host` (`configuration_invalid`) |
| Auth-Required & Unreachable Classification | API Test + Browser | PASS | 401 -> `authentication_required`; ECONNREFUSED -> `unreachable` |
| `/api/comfyui/models` (`/object_info`) | Mock ComfyUI API | PASS | Parses checkpoints, UNETs, LoRAs, and node types for LTX/Wan checks |
| `/api/comfyui/upload-image` (`/upload/image`) | Mock ComfyUI API | PASS | Multipart upload forwards filename and binary bytes cleanly |
| `/api/comfyui/prompt` + `/history` + `/view` | Mock ComfyUI API | PASS | Submits workflow, parses output refs, streams output bytes |
| `/api/vision/test` + `/api/vision/analyze` | Mock Qwen Server | PASS | Probes `/v1/models`, parses structured VLM JSON |
| Real FFmpeg MP4 Render + Amharic/Oromo SRT | Real Binary + Chromium | PASS | Rendered `midnight_in_addis_demo_production.mp4` (`4562.3 KB`) in UI & verified ISO `ftyp` header in test |
