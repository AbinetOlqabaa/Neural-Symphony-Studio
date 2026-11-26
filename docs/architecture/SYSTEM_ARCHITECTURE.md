# System Architecture — Neural Symphony Studio

## 1. High-Level Layered Architecture

```
+-------------------------------------------------------------------+
|                  NEURAL SYMPHONY STUDIO (React SPA)               |
|  16 Studio Modules: Dashboard, Projects, Media, Image Intel,      |
|  Characters, Scenes, Prompts, Generation, Queue, Timeline,        |
|  Music & Lyrics, Export, Workflows, Models, Monitor, Settings     |
+---------------------------------+---------------------------------+
                                  |
                  Client Storage  |  REST / SSE / Proxy (/api/*)
                 (IndexedDB)      |
                                  v
+-------------------------------------------------------------------+
|              STUDIO BACKEND (Express + TypeScript)                |
|  - /api/gemini/*    : Server-side @google/genai (Vision, Planner) |
|  - /api/vision/*    : External Qwen2.5-VL endpoint proxy          |
|  - /api/comfyui/*   : Safe ComfyUI API proxy & diagnostics        |
|  - /api/projects/*  : Server backup & ZIP archive import/export   |
|  - /api/render/*    : External FFmpeg render service interface    |
+---------------------------------+---------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                     GENERATION ADAPTER LAYER                      |
|  - EngineAdapter Interface (health, models, validate, submit,     |
|    monitor, cancel, fetchOutput)                                  |
|  - ComfyUIAdapter (HTTP/WS workflow execution)                    |
|  - LTXVideoAdapter (Lightricks/LTX-Video-0.9.5 rules & templates) |
|  - WanAdapter (Wan I2V workflow template & capability matrix)     |
+---------------------------------+---------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                   EXTERNAL INFERENCE BACKENDS                     |
|  - ComfyUI Server (Colab / Local NVIDIA GPU / Dedicated Server)   |
|  - Qwen2.5-VL-3B-Instruct OpenAI-compatible Vision Endpoint       |
|  - Gemini API (Server-side via GEMINI_API_KEY)                    |
|  - External FFmpeg Assembly Worker (when configured)              |
+-------------------------------------------------------------------+
```

## 2. Core Data Flow

1. **Ingestion**: Images (JPG, PNG, WEBP) or `.zip` archives are parsed safely, hashed for duplicate detection, measured for natural dimensions, and stored as immutable original blobs + lightweight thumbnails in IndexedDB (`idb-store`) and project manifests.
2. **Image Intelligence**: Each asset can be analyzed via Gemini (`gemini-4-hydrogen` multimodal) or a configured external Qwen2.5-VL endpoint, producing structured JSON (`subjects`, `clothing`, `hairstyle`, `lighting`, `cameraPerspective`, `emotionalExpression`, `suggestedCinematicTreatment`) that users can manually review and edit.
3. **Character Bible**: Stable `char_*` identities link recurring assets, store appearance constraints and preservation instructions, and support human-verified merge/split workflows.
4. **Scene Planner & Prompt Studio**: Scenes reference Character IDs + Reference Assets + Camera/Motion parameters. Prompt Studio compiles engine-specific Positive/Negative prompts with versioned history (`v1`, `v2`, ...).
5. **Generation Engine Manager**: Adapters enforce model-specific constraints (e.g., LTX-Video-0.9.5 `8n + 1` frame count constraint and `32px`-divisible dimensions) before dispatching workflow JSON to ComfyUI or running in clearly labeled Offline Simulation mode.
6. **Quality Review, Music & Timeline**: Clips track three distinct states (`Technically Generated`, `Visually Acceptable`, `Production Approved`), support frame-by-frame comparison against the reference image, synchronize against Unicode lyrics (English, Amharic, Afaan Oromoo) and audio tracks, and package into a portable `.zip` project archive.
