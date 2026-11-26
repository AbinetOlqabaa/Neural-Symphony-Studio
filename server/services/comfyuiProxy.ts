import type { ComfyConnectionStatus, ComfyObjectInfoSummary, ComfyOutputFileRef, ComfyUISystemStats } from '../../src/types/studio';
import { sanitizeComfyPathSegment, sanitizeUploadFileName, validateExternalServiceUrl } from './urlGuard';

const lastSuccessfulConnectionMap = new Map<string, string>();

export function resolveComfyUrl(rawUrl?: string): string {
  const candidate = (rawUrl || '').trim() || (process.env.COMFYUI_SERVER_URL || '').trim();
  return candidate;
}

export function resolveComfyTimeout(overrideMs?: number): number {
  const envVal = Number(process.env.COMFYUI_TIMEOUT_MS || 8000);
  const raw = typeof overrideMs === 'number' && Number.isFinite(overrideMs) ? overrideMs : envVal;
  return Math.max(1000, Math.min(60000, Math.round(raw)));
}

export function isComfyAuthConfigured(): boolean {
  return Boolean(process.env.COMFYUI_API_TOKEN && process.env.COMFYUI_API_TOKEN.trim().length > 0);
}

export function buildComfyAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const token = (process.env.COMFYUI_API_TOKEN || '').trim();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function classifyHttpErrorStatus(statusCode: number): ComfyConnectionStatus {
  if (statusCode === 401 || statusCode === 403) return 'authentication_required';
  return 'disconnected';
}

function classifyNetworkError(err: unknown): { status: ComfyConnectionStatus; message: string } {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
    const causeCode = cause?.code ? ` (${cause.code})` : '';
    const msg =
      err.message === 'fetch failed' && cause?.code
        ? `Unable to reach ComfyUI server${causeCode}: ${cause.message || 'connection refused'}`
        : `${err.message || 'Connection failed'}${causeCode}`;
    const lower = msg.toLowerCase();
    if (
      lower.includes('timeout') ||
      lower.includes('aborted') ||
      lower.includes('econnrefused') ||
      lower.includes('enotfound') ||
      lower.includes('fetch failed') ||
      lower.includes('unable to reach') ||
      lower.includes('network')
    ) {
      return { status: 'unreachable', message: msg };
    }
    return { status: 'disconnected', message: msg };
  }
  return { status: 'unknown', message: 'Connection failed' };
}

export async function probeComfyUiServer(rawUrl?: string, timeoutMs?: number): Promise<ComfyUISystemStats> {
  const candidate = resolveComfyUrl(rawUrl);
  const timeout = resolveComfyTimeout(timeoutMs);
  const authConfigured = isComfyAuthConfigured();
  const checkedAt = new Date().toISOString();

  if (!candidate) {
    return {
      connected: false,
      status: 'disconnected',
      url: '',
      latencyMs: null,
      authConfigured,
      error: 'ComfyUI server URL is not configured.',
      checkedAt,
    };
  }

  const check = validateExternalServiceUrl(candidate);
  if (!check.valid || !check.normalizedUrl) {
    return {
      connected: false,
      status: 'configuration_invalid',
      url: candidate,
      latencyMs: null,
      authConfigured,
      error: check.error || 'Invalid ComfyUI URL',
      checkedAt,
    };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${check.normalizedUrl}/system_stats`, {
      headers: buildComfyAuthHeaders(),
      signal: AbortSignal.timeout(timeout),
    });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const status = classifyHttpErrorStatus(res.status);
      return {
        connected: false,
        status,
        url: check.normalizedUrl,
        latencyMs,
        authConfigured,
        lastSuccessfulConnection: lastSuccessfulConnectionMap.get(check.normalizedUrl),
        error:
          status === 'authentication_required'
            ? `Authentication required (HTTP ${res.status}). Configure COMFYUI_API_TOKEN on the Studio server.`
            : `ComfyUI returned HTTP ${res.status}`,
        checkedAt,
      };
    }

    const data = (await res.json()) as {
      system?: { comfyui_version?: string; pytorch_version?: string; os?: string; ram_total?: number; ram_free?: number };
      devices?: Array<{ name?: string; vram_total?: number; vram_free?: number }>;
    };
    const primaryGpu = data.devices?.[0];
    lastSuccessfulConnectionMap.set(check.normalizedUrl, checkedAt);

    return {
      connected: true,
      status: 'connected',
      url: check.normalizedUrl,
      latencyMs,
      comfyVersion: data.system?.comfyui_version,
      pytorchVersion: data.system?.pytorch_version,
      os: data.system?.os,
      ramTotalBytes: data.system?.ram_total,
      ramFreeBytes: data.system?.ram_free,
      gpuName: primaryGpu?.name,
      vramTotalBytes: primaryGpu?.vram_total,
      vramFreeBytes: primaryGpu?.vram_free,
      authConfigured,
      lastSuccessfulConnection: checkedAt,
      checkedAt,
    };
  } catch (err) {
    const classified = classifyNetworkError(err);
    return {
      connected: false,
      status: classified.status,
      url: check.normalizedUrl,
      latencyMs: null,
      authConfigured,
      lastSuccessfulConnection: lastSuccessfulConnectionMap.get(check.normalizedUrl),
      error: classified.message,
      checkedAt,
    };
  }
}

export async function fetchComfyObjectInfo(rawUrl?: string, timeoutMs?: number): Promise<ComfyObjectInfoSummary> {
  const check = validateExternalServiceUrl(resolveComfyUrl(rawUrl));
  if (!check.valid || !check.normalizedUrl) {
    throw new Error(check.error || 'Invalid ComfyUI URL');
  }

  const res = await fetch(`${check.normalizedUrl}/object_info`, {
    headers: buildComfyAuthHeaders(),
    signal: AbortSignal.timeout(resolveComfyTimeout(timeoutMs)),
  });
  if (!res.ok) {
    throw new Error(`ComfyUI /object_info returned HTTP ${res.status}`);
  }
  const objectInfo = (await res.json()) as Record<
    string,
    { input?: { required?: Record<string, unknown[]> } }
  >;

  const checkpoints =
    (objectInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] as string[] | undefined) || [];
  const unets = (objectInfo.UNETLoader?.input?.required?.unet_name?.[0] as string[] | undefined) || [];
  const loras = (objectInfo.LoraLoader?.input?.required?.lora_name?.[0] as string[] | undefined) || [];
  const nodeTypes = Object.keys(objectInfo);

  return { checkpoints, unets, loras, nodeCount: nodeTypes.length, nodeTypes };
}

export async function uploadImageToComfyUi(
  rawUrl: string | undefined,
  input: {
    fileName: string;
    mimeType?: string;
    base64Data: string;
    overwrite?: boolean;
    timeoutMs?: number;
  }
): Promise<{ name: string; subfolder: string; type: string }> {
  const check = validateExternalServiceUrl(resolveComfyUrl(rawUrl));
  if (!check.valid || !check.normalizedUrl) {
    throw new Error(check.error || 'Invalid ComfyUI URL');
  }
  if (!input.base64Data) {
    throw new Error('base64Data is required for ComfyUI image upload.');
  }

  const cleanBase64 = input.base64Data.includes(',') ? input.base64Data.split(',')[1] : input.base64Data;
  const binary = Buffer.from(cleanBase64, 'base64');
  const safeName = sanitizeUploadFileName(input.fileName);
  const blob = new Blob([binary], { type: input.mimeType || 'image/png' });

  const form = new FormData();
  form.append('image', blob, safeName);
  form.append('type', 'input');
  form.append('overwrite', input.overwrite === false ? 'false' : 'true');

  const res = await fetch(`${check.normalizedUrl}/upload/image`, {
    method: 'POST',
    headers: buildComfyAuthHeaders(),
    body: form,
    signal: AbortSignal.timeout(resolveComfyTimeout(input.timeoutMs ?? 15000)),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ComfyUI /upload/image failed (${res.status}): ${text.slice(0, 240)}`);
  }

  const payload = (await res.json()) as { name?: string; subfolder?: string; type?: string };
  return {
    name: payload.name || safeName,
    subfolder: payload.subfolder || '',
    type: payload.type || 'input',
  };
}

export async function submitComfyPrompt(
  rawUrl: string | undefined,
  workflowPrompt: Record<string, unknown>,
  clientId: string,
  timeoutMs?: number
): Promise<{ prompt_id: string; number?: number; node_errors?: Record<string, unknown> }> {
  const check = validateExternalServiceUrl(resolveComfyUrl(rawUrl));
  if (!check.valid || !check.normalizedUrl) {
    throw new Error(check.error || 'Invalid ComfyUI URL');
  }

  const res = await fetch(`${check.normalizedUrl}/prompt`, {
    method: 'POST',
    headers: buildComfyAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prompt: workflowPrompt, client_id: clientId }),
    signal: AbortSignal.timeout(resolveComfyTimeout(timeoutMs ?? 12000)),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    throw new Error(`ComfyUI /prompt failed (${res.status}): ${bodyText.slice(0, 320)}`);
  }

  return res.json();
}

export async function fetchComfyQueue(rawUrl?: string, timeoutMs?: number) {
  const check = validateExternalServiceUrl(resolveComfyUrl(rawUrl));
  if (!check.valid || !check.normalizedUrl) {
    throw new Error(check.error || 'Invalid ComfyUI URL');
  }
  const res = await fetch(`${check.normalizedUrl}/queue`, {
    headers: buildComfyAuthHeaders(),
    signal: AbortSignal.timeout(resolveComfyTimeout(timeoutMs)),
  });
  if (!res.ok) throw new Error(`ComfyUI /queue failed (${res.status})`);
  return res.json();
}

export async function fetchComfyHistory(rawUrl: string | undefined, promptId: string, timeoutMs?: number) {
  const check = validateExternalServiceUrl(resolveComfyUrl(rawUrl));
  if (!check.valid || !check.normalizedUrl) {
    throw new Error(check.error || 'Invalid ComfyUI URL');
  }
  const res = await fetch(`${check.normalizedUrl}/history/${encodeURIComponent(promptId)}`, {
    headers: buildComfyAuthHeaders(),
    signal: AbortSignal.timeout(resolveComfyTimeout(timeoutMs)),
  });
  if (!res.ok) throw new Error(`ComfyUI /history failed (${res.status})`);
  return res.json();
}

export async function interruptComfyServer(rawUrl?: string, timeoutMs?: number): Promise<{ ok: boolean }> {
  const check = validateExternalServiceUrl(resolveComfyUrl(rawUrl));
  if (!check.valid || !check.normalizedUrl) {
    throw new Error(check.error || 'Invalid ComfyUI URL');
  }
  const res = await fetch(`${check.normalizedUrl}/interrupt`, {
    method: 'POST',
    headers: buildComfyAuthHeaders(),
    signal: AbortSignal.timeout(resolveComfyTimeout(timeoutMs ?? 5000)),
  });
  return { ok: res.ok };
}

export async function fetchComfyOutputAsset(
  rawUrl: string | undefined,
  query: { filename: string; subfolder?: string; type?: string; timeoutMs?: number }
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const check = validateExternalServiceUrl(resolveComfyUrl(rawUrl));
  if (!check.valid || !check.normalizedUrl) {
    throw new Error(check.error || 'Invalid ComfyUI URL');
  }

  const filename = sanitizeComfyPathSegment(query.filename, false);
  const subfolder = sanitizeComfyPathSegment(query.subfolder || '', true);
  const assetType = query.type === 'input' || query.type === 'temp' ? query.type : 'output';

  const params = new URLSearchParams({ filename, type: assetType });
  if (subfolder) params.set('subfolder', subfolder);

  const res = await fetch(`${check.normalizedUrl}/view?${params.toString()}`, {
    headers: buildComfyAuthHeaders(),
    signal: AbortSignal.timeout(resolveComfyTimeout(query.timeoutMs ?? 20000)),
  });

  if (!res.ok) {
    throw new Error(`ComfyUI /view failed (${res.status})`);
  }

  const arrayBuf = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuf),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    filename,
  };
}

export function extractComfyOutputsFromHistory(
  historyPayload: Record<string, unknown>,
  promptId: string
): {
  completed: boolean;
  statusStr?: string;
  outputs: ComfyOutputFileRef[];
} {
  const entry = historyPayload[promptId] as
    | {
        status?: { completed?: boolean; status_str?: string };
        outputs?: Record<
          string,
          {
            videos?: Array<{ filename: string; subfolder?: string; type?: string }>;
            gifs?: Array<{ filename: string; subfolder?: string; type?: string }>;
            images?: Array<{ filename: string; subfolder?: string; type?: string }>;
          }
        >;
      }
    | undefined;

  if (!entry) {
    return { completed: false, outputs: [] };
  }

  const outputs: ComfyOutputFileRef[] = [];
  if (entry.outputs && typeof entry.outputs === 'object') {
    for (const [nodeId, nodeOut] of Object.entries(entry.outputs)) {
      for (const vid of [...(nodeOut.videos || []), ...(nodeOut.gifs || [])]) {
        if (!vid?.filename) continue;
        outputs.push({
          filename: vid.filename,
          subfolder: vid.subfolder || '',
          type: vid.type === 'input' || vid.type === 'temp' ? vid.type : 'output',
          nodeId,
          mediaKind: vid.filename.toLowerCase().endsWith('.webp') || vid.filename.toLowerCase().endsWith('.gif')
            ? 'video'
            : 'video',
        });
      }
      for (const img of nodeOut.images || []) {
        if (!img?.filename) continue;
        outputs.push({
          filename: img.filename,
          subfolder: img.subfolder || '',
          type: img.type === 'input' || img.type === 'temp' ? img.type : 'output',
          nodeId,
          mediaKind: 'image',
        });
      }
    }
  }

  const statusCompleted = entry.status?.completed !== false && (outputs.length > 0 || entry.status?.completed === true);
  return {
    completed: statusCompleted,
    statusStr: entry.status?.status_str,
    outputs,
  };
}
