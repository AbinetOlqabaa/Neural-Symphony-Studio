import type {
  AIModelEntry,
  AIProviderConfig,
  ComfyExecutionEvent,
  ComfyObjectInfoSummary,
  ComfyOutputFileRef,
  ComfyUISystemStats,
  ExportSettings,
  ImageAnalysis,
  LyricLine,
  RenderJobStatus,
  RoutingPriority,
  ServerCredentialStatus,
  TaskRoutingRule,
  TaskType,
} from '../../types/studio';

export interface BackendHealth {
  status: string;
  nodeVersion: string;
  uptimeSec: number;
  geminiConfigured: boolean;
  geminiDefaultModel?: string;
  allowedGeminiModels?: string[];
  comfyEnvUrlConfigured?: boolean;
  comfyAuthConfigured?: boolean;
  qwenEnvUrlConfigured?: boolean;
  qwenAuthConfigured?: boolean;
  ffmpegAvailable: boolean;
  ffmpegVersion: string | null;
  timestamp: string;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed with HTTP ${res.status}`);
  }
  return data as T;
}

export async function fetchBackendHealth(): Promise<BackendHealth> {
  const res = await fetch('/api/health');
  return parseJsonOrThrow<BackendHealth>(res);
}

export async function testComfyUiConnection(url: string, timeoutMs?: number): Promise<ComfyUISystemStats> {
  const res = await fetch('/api/comfyui/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, timeoutMs }),
  });
  return parseJsonOrThrow<ComfyUISystemStats>(res);
}

export async function fetchComfyUiModels(url: string, timeoutMs?: number): Promise<ComfyObjectInfoSummary> {
  const res = await fetch('/api/comfyui/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, timeoutMs }),
  });
  return parseJsonOrThrow<ComfyObjectInfoSummary>(res);
}

export async function uploadImageToComfyUi(input: {
  url: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
  timeoutMs?: number;
}): Promise<{ name: string; subfolder: string; type: string }> {
  const res = await fetch('/api/comfyui/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res);
}

export async function submitComfyUiWorkflow(
  url: string,
  workflowPrompt: Record<string, unknown>,
  clientId: string,
  timeoutMs?: number
): Promise<{ prompt_id: string; number?: number }> {
  const res = await fetch('/api/comfyui/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, workflowPrompt, clientId, timeoutMs }),
  });
  return parseJsonOrThrow(res);
}

export async function fetchComfyUiHistory(
  url: string,
  promptId: string,
  timeoutMs?: number
): Promise<{
  raw: Record<string, unknown>;
  parsed: { completed: boolean; statusStr?: string; outputs: ComfyOutputFileRef[] };
}> {
  const res = await fetch('/api/comfyui/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, promptId, timeoutMs }),
  });
  return parseJsonOrThrow(res);
}

export async function fetchComfyUiQueue(url: string, timeoutMs?: number): Promise<{
  queue_running?: unknown[];
  queue_pending?: unknown[];
}> {
  const res = await fetch('/api/comfyui/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, timeoutMs }),
  });
  return parseJsonOrThrow(res);
}

export async function interruptComfyUi(url: string): Promise<{ ok: boolean }> {
  const res = await fetch('/api/comfyui/interrupt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return parseJsonOrThrow(res);
}

export function buildComfyViewUrl(comfyUrl: string, file: ComfyOutputFileRef): string {
  const params = new URLSearchParams({
    url: comfyUrl,
    filename: file.filename,
    subfolder: file.subfolder || '',
    type: file.type || 'output',
  });
  return `/api/comfyui/view?${params.toString()}`;
}

export function subscribeComfyUiEvents(
  comfyUrl: string,
  clientId: string,
  onEvent: (event: ComfyExecutionEvent) => void
): () => void {
  const params = new URLSearchParams({ url: comfyUrl });
  const source = new EventSource(`/api/comfyui/events/${encodeURIComponent(clientId)}?${params.toString()}`);

  source.onmessage = (evt) => {
    try {
      const parsed = JSON.parse(evt.data) as ComfyExecutionEvent;
      onEvent(parsed);
    } catch {
      // Ignore malformed SSE payload
    }
  };

  return () => {
    source.close();
  };
}

export async function testQwenEndpointConnection(endpointUrl: string): Promise<{
  connected: boolean;
  url: string;
  latencyMs: number | null;
  models: string[];
  authConfigured: boolean;
  error?: string;
}> {
  const res = await fetch('/api/vision/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpointUrl }),
  });
  return parseJsonOrThrow(res);
}

export async function analyzeImageViaGemini(input: {
  assetId: string;
  base64Data: string;
  mimeType: string;
  fileName: string;
  model?: string;
}): Promise<ImageAnalysis> {
  const res = await fetch('/api/gemini/analyze-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow<ImageAnalysis>(res);
}

export async function analyzeImageViaQwen(input: {
  endpointUrl: string;
  modelId: string;
  assetId: string;
  base64Data: string;
  mimeType: string;
}): Promise<ImageAnalysis> {
  const res = await fetch('/api/vision/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow<ImageAnalysis>(res);
}

export async function generateAiScenePlan(input: {
  projectName: string;
  projectDescription: string;
  assetsSummary: Array<{ id: string; fileName: string; description: string }>;
  charactersSummary: Array<{ id: string; name: string; appearance: string }>;
  lyricsExcerpt: string;
  model?: string;
}): Promise<{ scenes: Array<Record<string, unknown>> }> {
  const res = await fetch('/api/gemini/plan-scenes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res);
}

export async function synthesizeAiPrompt(input: {
  engine: string;
  sceneTitle: string;
  sceneDescription: string;
  characterInstructions: string;
  userNotes: string;
  model?: string;
}): Promise<{ positivePrompt: string; negativePrompt: string }> {
  const res = await fetch('/api/gemini/synthesize-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res);
}

export async function createServerRenderJob(input: {
  projectId: string;
  projectName: string;
  segments: Array<{
    title: string;
    durationSec: number;
    videoDataUrl?: string;
    imageDataUrl?: string;
  }>;
  exportSettings: ExportSettings;
  audioDataUrl?: string;
  audioFileName?: string;
  lyrics?: LyricLine[];
}): Promise<RenderJobStatus> {
  const res = await fetch('/api/render/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow<RenderJobStatus>(res);
}

export async function fetchServerRenderJob(jobId: string): Promise<RenderJobStatus> {
  const res = await fetch(`/api/render/jobs/${encodeURIComponent(jobId)}`);
  return parseJsonOrThrow<RenderJobStatus>(res);
}

export function buildServerRenderOutputUrl(jobId: string): string {
  return `/api/render/jobs/${encodeURIComponent(jobId)}/output`;
}

export async function fetchProviderCredentialsStatus(
  providers: AIProviderConfig[]
): Promise<Record<string, ServerCredentialStatus>> {
  const res = await fetch('/api/providers/credentials/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providers }),
  });
  const data = await parseJsonOrThrow<{ credentials: Record<string, ServerCredentialStatus> }>(res);
  return data.credentials;
}

export async function saveProviderSessionCredential(
  providerId: string,
  apiKey: string
): Promise<ServerCredentialStatus> {
  const res = await fetch(`/api/providers/${encodeURIComponent(providerId)}/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  return parseJsonOrThrow<ServerCredentialStatus>(res);
}

export async function testAiProvider(
  provider: AIProviderConfig,
  timeoutMs = 10000
): Promise<{
  providerId: string;
  connected: boolean;
  status: string;
  latencyMs: number | null;
  discoveredModels: string[];
  error?: string;
  checkedAt: string;
}> {
  const res = await fetch('/api/providers/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, timeoutMs }),
  });
  return parseJsonOrThrow(res);
}

export async function executeOrchestratedAiTask(input: {
  taskType: TaskType;
  prompt: string;
  systemInstruction?: string;
  responseJson?: boolean;
  providers: AIProviderConfig[];
  models: AIModelEntry[];
  routingRules: TaskRoutingRule[];
  priority?: RoutingPriority;
  manualOverride?: { providerId: string; modelId?: string };
}): Promise<{
  outputText: string;
  providerUsed: string;
  modelUsed: string;
  usedFallback: boolean;
  fallbackReason?: string;
  userNotice: string;
}> {
  const res = await fetch('/api/orchestration/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res);
}
