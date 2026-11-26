import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';
import { subscribeComfyEvents } from './services/comfyuiMonitor';
import {
  extractComfyOutputsFromHistory,
  fetchComfyHistory,
  fetchComfyObjectInfo,
  fetchComfyOutputAsset,
  fetchComfyQueue,
  interruptComfyServer,
  isComfyAuthConfigured,
  probeComfyUiServer,
  resolveComfyUrl,
  submitComfyPrompt,
  uploadImageToComfyUi,
} from './services/comfyuiProxy';
import { createRenderJob, getRenderJobStatus, getRenderOutputFile } from './services/ffmpegService';
import {
  ALLOWED_GEMINI_MODELS,
  analyzeImageWithGemini,
  generateScenePlanWithGemini,
  isGeminiConfigured,
  resolveGeminiModel,
  synthesizePromptWithGemini,
  translateGeminiError,
} from './services/geminiService';
import {
  executeOrchestratedTask,
  getAllCredentialStatuses,
  setSessionCredential,
  testAiProviderConnection,
} from './services/aiOrchestrator';
import { DEFAULT_AI_PROVIDERS } from '../src/modules/ai-orchestration/orchestratorRules';
import type { AIProviderConfig } from '../src/types/studio';
import { analyzeImageWithQwen, resolveQwenEndpoint, testQwenEndpoint } from './services/qwenService';

const execFileAsync = promisify(execFile);

export async function checkFfmpegBinary(): Promise<{ available: boolean; version?: string }> {
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-version'], { shell: false, timeout: 2500 });
    const firstLine = stdout.split('\n')[0]?.trim();
    return { available: true, version: firstLine };
  } catch {
    return { available: false };
  }
}

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', async (_req, res) => {
    const ffmpeg = await checkFfmpegBinary();
    res.json({
      status: 'ok',
      nodeVersion: process.version,
      uptimeSec: Math.round(process.uptime()),
      geminiConfigured: isGeminiConfigured(),
      geminiDefaultModel: resolveGeminiModel(),
      allowedGeminiModels: ALLOWED_GEMINI_MODELS,
      comfyEnvUrlConfigured: Boolean(resolveComfyUrl()),
      comfyAuthConfigured: isComfyAuthConfigured(),
      qwenEnvUrlConfigured: Boolean(resolveQwenEndpoint()),
      qwenAuthConfigured: Boolean((process.env.QWEN_VL_API_KEY || '').trim()),
      ffmpegAvailable: ffmpeg.available,
      ffmpegVersion: ffmpeg.version || null,
      timestamp: new Date().toISOString(),
    });
  });

  // Multi-Provider AI Orchestration & Secure Credential Status Routes
  app.post('/api/providers/credentials/status', (req, res) => {
    const providers = Array.isArray(req.body?.providers)
      ? (req.body.providers as AIProviderConfig[])
      : DEFAULT_AI_PROVIDERS;
    res.json({ credentials: getAllCredentialStatuses(providers) });
  });

  app.get('/api/providers/credentials', (_req, res) => {
    res.json({ credentials: getAllCredentialStatuses(DEFAULT_AI_PROVIDERS) });
  });

  app.post('/api/providers/:id/credentials', (req, res) => {
    try {
      const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey : '';
      const status = setSessionCredential(req.params.id, apiKey);
      res.json(status);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Credential update failed.' });
    }
  });

  app.post('/api/providers/test', async (req, res) => {
    try {
      const provider = req.body?.provider as AIProviderConfig | undefined;
      const timeoutMs = typeof req.body?.timeoutMs === 'number' ? req.body.timeoutMs : 10000;
      if (!provider || !provider.id || !provider.kind) {
        res.status(400).json({ error: 'Valid provider configuration object is required.' });
        return;
      }
      const result = await testAiProviderConnection(provider, timeoutMs);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Provider test failed.' });
    }
  });

  app.post('/api/orchestration/execute', async (req, res) => {
    try {
      const {
        taskType,
        prompt,
        systemInstruction,
        responseJson,
        providers,
        models,
        routingRules,
        priority,
        manualOverride,
      } = req.body ?? {};
      if (!taskType || !prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'taskType and prompt are required.' });
        return;
      }
      const out = await executeOrchestratedTask({
        taskType,
        prompt,
        systemInstruction,
        responseJson: Boolean(responseJson),
        providers,
        models,
        routingRules,
        priority,
        manualOverride,
      });
      res.json(out);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Orchestrated task failed.';
      const status = msg.toLowerCase().includes('unavailable') || msg.toLowerCase().includes('requires') ? 503 : 502;
      res.status(status).json({ error: msg });
    }
  });

  // Gemini AI Routes
  app.post('/api/gemini/analyze-image', async (req, res) => {
    try {
      const { assetId, base64Data, mimeType, fileName, model } = req.body ?? {};
      if (!assetId || !base64Data) {
        res.status(400).json({ error: 'assetId and base64Data are required.' });
        return;
      }
      const result = await analyzeImageWithGemini({
        assetId,
        base64Data,
        mimeType,
        fileName: fileName || 'image',
        model,
      });
      res.json(result);
    } catch (err) {
      const mapped = translateGeminiError(err);
      res.status(mapped.statusCode).json({ error: mapped.message });
    }
  });

  app.post('/api/gemini/plan-scenes', async (req, res) => {
    try {
      const { projectName, projectDescription, assetsSummary, charactersSummary, lyricsExcerpt, model } =
        req.body ?? {};
      if (!projectName) {
        res.status(400).json({ error: 'projectName is required.' });
        return;
      }
      const scenes = await generateScenePlanWithGemini({
        projectName,
        projectDescription: projectDescription || '',
        assetsSummary: Array.isArray(assetsSummary) ? assetsSummary : [],
        charactersSummary: Array.isArray(charactersSummary) ? charactersSummary : [],
        lyricsExcerpt: lyricsExcerpt || '',
        model,
      });
      res.json({ scenes });
    } catch (err) {
      const mapped = translateGeminiError(err);
      res.status(mapped.statusCode).json({ error: mapped.message });
    }
  });

  app.post('/api/gemini/synthesize-prompt', async (req, res) => {
    try {
      const { engine, sceneTitle, sceneDescription, characterInstructions, userNotes, model } = req.body ?? {};
      if (!sceneTitle || !sceneDescription) {
        res.status(400).json({ error: 'sceneTitle and sceneDescription are required.' });
        return;
      }
      const result = await synthesizePromptWithGemini({
        engine: engine || 'ltx-video',
        sceneTitle,
        sceneDescription,
        characterInstructions: characterInstructions || '',
        userNotes: userNotes || '',
        model,
      });
      res.json(result);
    } catch (err) {
      const mapped = translateGeminiError(err);
      res.status(mapped.statusCode).json({ error: mapped.message });
    }
  });

  // External Vision Endpoint Proxy (Qwen2.5-VL OpenAI-compatible)
  app.post('/api/vision/test', async (req, res) => {
    const { endpointUrl } = req.body ?? {};
    const status = await testQwenEndpoint(endpointUrl);
    res.json(status);
  });

  app.post('/api/vision/analyze', async (req, res) => {
    try {
      const { endpointUrl, modelId, assetId, base64Data, mimeType } = req.body ?? {};
      const result = await analyzeImageWithQwen({
        endpointUrl,
        modelId,
        assetId,
        base64Data,
        mimeType,
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'External vision inference failed.',
      });
    }
  });

  // ComfyUI Proxy & Live Monitor Routes
  app.post('/api/comfyui/test', async (req, res) => {
    const { url, timeoutMs } = req.body ?? {};
    const stats = await probeComfyUiServer(url, timeoutMs);
    res.json(stats);
  });

  app.post('/api/comfyui/models', async (req, res) => {
    try {
      const { url, timeoutMs } = req.body ?? {};
      const models = await fetchComfyObjectInfo(url, timeoutMs);
      res.json(models);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to load ComfyUI models.' });
    }
  });

  app.post('/api/comfyui/upload-image', async (req, res) => {
    try {
      const { url, fileName, mimeType, base64Data, overwrite, timeoutMs } = req.body ?? {};
      const uploaded = await uploadImageToComfyUi(url, {
        fileName: fileName || 'reference.png',
        mimeType,
        base64Data,
        overwrite,
        timeoutMs,
      });
      res.json(uploaded);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'ComfyUI image upload failed.' });
    }
  });

  app.post('/api/comfyui/queue', async (req, res) => {
    try {
      const { url, timeoutMs } = req.body ?? {};
      const queue = await fetchComfyQueue(url, timeoutMs);
      res.json(queue);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to inspect ComfyUI queue.' });
    }
  });

  app.post('/api/comfyui/prompt', async (req, res) => {
    try {
      const { url, workflowPrompt, clientId, timeoutMs } = req.body ?? {};
      if (!workflowPrompt || typeof workflowPrompt !== 'object' || Array.isArray(workflowPrompt)) {
        res.status(400).json({ error: 'workflowPrompt API JSON object is required.' });
        return;
      }
      const result = await submitComfyPrompt(
        url,
        workflowPrompt as Record<string, unknown>,
        clientId || 'neural-symphony-studio',
        timeoutMs
      );
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'ComfyUI prompt submission failed.' });
    }
  });

  app.post('/api/comfyui/history', async (req, res) => {
    try {
      const { url, promptId, timeoutMs } = req.body ?? {};
      if (!promptId || typeof promptId !== 'string') {
        res.status(400).json({ error: 'promptId is required.' });
        return;
      }
      const raw = (await fetchComfyHistory(url, promptId, timeoutMs)) as Record<string, unknown>;
      const parsed = extractComfyOutputsFromHistory(raw, promptId);
      res.json({ raw, parsed });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'ComfyUI history lookup failed.' });
    }
  });

  app.post('/api/comfyui/interrupt', async (req, res) => {
    try {
      const { url, timeoutMs } = req.body ?? {};
      const result = await interruptComfyServer(url, timeoutMs);
      res.status(result.ok ? 200 : 502).json(result);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Interrupt failed.' });
    }
  });

  app.get('/api/comfyui/view', async (req, res) => {
    try {
      const url = typeof req.query.url === 'string' ? req.query.url : undefined;
      const filename = typeof req.query.filename === 'string' ? req.query.filename : '';
      const subfolder = typeof req.query.subfolder === 'string' ? req.query.subfolder : '';
      const type = typeof req.query.type === 'string' ? req.query.type : 'output';
      const asset = await fetchComfyOutputAsset(url, { filename, subfolder, type });
      res.setHeader('Content-Type', asset.contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(asset.buffer);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch ComfyUI output.' });
    }
  });

  app.get('/api/comfyui/events/:clientId', (req, res) => {
    const url = typeof req.query.url === 'string' ? req.query.url : undefined;
    subscribeComfyEvents(url, req.params.clientId, res);
  });

  // Render / FFmpeg Routes
  app.get('/api/render/status', async (_req, res) => {
    const ffmpeg = await checkFfmpegBinary();
    res.json({
      localFfmpegAvailable: ffmpeg.available,
      ffmpegVersion: ffmpeg.version || null,
      remoteWorkerConfigured: Boolean((process.env.FFMPEG_RENDER_SERVICE_URL || '').trim()),
      supportsRemoteWorker: true,
    });
  });

  app.post('/api/render/jobs', async (req, res) => {
    try {
      const ffmpeg = await checkFfmpegBinary();
      if (!ffmpeg.available) {
        res.status(503).json({ error: 'Local FFmpeg binary is not available on the server.' });
        return;
      }
      const { projectId, projectName, segments, exportSettings, audioDataUrl, audioFileName, lyrics } =
        req.body ?? {};
      if (!projectId || !projectName || !Array.isArray(segments) || segments.length === 0) {
        res.status(400).json({ error: 'projectId, projectName, and at least one segment are required.' });
        return;
      }
      const job = await createRenderJob({
        projectId,
        projectName,
        segments,
        exportSettings,
        audioDataUrl,
        audioFileName,
        lyrics: Array.isArray(lyrics) ? lyrics : [],
      });
      res.status(202).json(job);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to start FFmpeg render.' });
    }
  });

  app.get('/api/render/jobs/:id', (req, res) => {
    const status = getRenderJobStatus(req.params.id);
    if (!status) {
      res.status(404).json({ error: 'Render job not found.' });
      return;
    }
    res.json(status);
  });

  app.get('/api/render/jobs/:id/output', (req, res) => {
    const output = getRenderOutputFile(req.params.id);
    if (!output) {
      res.status(404).json({ error: 'Rendered MP4 file not found or job not yet complete.' });
      return;
    }
    res.download(output.filePath, output.fileName);
  });

  return app;
}
