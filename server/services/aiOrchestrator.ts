import { GoogleGenAI } from '@google/genai';
import {
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_TASK_ROUTING_RULES,
  resolveTaskRoute,
  type ProviderProbeSnapshot,
} from '../../src/modules/ai-orchestration/orchestratorRules';
import type {
  AIModelEntry,
  AIProviderConfig,
  RoutingPriority,
  ServerCredentialStatus,
  TaskRoutingRule,
  TaskType,
} from '../../src/types/studio';
import { probeComfyUiServer } from './comfyuiProxy';
import { isGeminiConfigured, resolveGeminiModel } from './geminiService';
import { testQwenEndpoint } from './qwenService';
import { validateExternalServiceUrl } from './urlGuard';

// Ephemeral server-side credential map for optional non-Gemini providers during a live server process.
// Never returned to the browser, never persisted in browser storage, and never exported in ZIP files.
const sessionCredentials = new Map<string, string>();

const ENV_KEY_BY_PROVIDER: Record<string, string> = {
  'google-gemini': 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  'qwen-vl': 'QWEN_VL_API_KEY',
  'openai-compatible': 'CUSTOM_OPENAI_COMPATIBLE_KEY',
  comfyui: 'COMFYUI_API_TOKEN',
};

function resolveEnvVarName(providerId: string, explicitEnvVar?: string): string | undefined {
  if (explicitEnvVar && /^[A-Z0-9_]+$/.test(explicitEnvVar)) {
    return explicitEnvVar;
  }
  return ENV_KEY_BY_PROVIDER[providerId];
}

function readServerSecret(providerId: string, explicitEnvVar?: string): string {
  const envVar = resolveEnvVarName(providerId, explicitEnvVar);
  if (envVar && process.env[envVar]?.trim()) {
    return process.env[envVar]!.trim();
  }
  if (providerId === 'google-gemini') {
    return (process.env.GEMINI_API_KEY || '').trim();
  }
  return sessionCredentials.get(providerId) || '';
}

export function getCredentialStatus(provider: AIProviderConfig): ServerCredentialStatus {
  const envVarName = resolveEnvVarName(provider.id, provider.authEnvVarName);
  if (envVarName && process.env[envVarName]?.trim()) {
    return {
      providerId: provider.id,
      hasCredential: true,
      source: 'env',
      envVarName,
    };
  }
  if (provider.id !== 'google-gemini' && sessionCredentials.has(provider.id)) {
    return {
      providerId: provider.id,
      hasCredential: true,
      source: 'session_memory',
      envVarName,
    };
  }
  return {
    providerId: provider.id,
    hasCredential: false,
    source: 'none',
    envVarName,
  };
}

export function getAllCredentialStatuses(providers: AIProviderConfig[]): Record<string, ServerCredentialStatus> {
  const result: Record<string, ServerCredentialStatus> = {};
  for (const provider of providers) {
    result[provider.id] = getCredentialStatus(provider);
  }
  return result;
}

export function setSessionCredential(providerId: string, apiKey: string): ServerCredentialStatus {
  if (providerId === 'google-gemini') {
    throw new Error('GEMINI_API_KEY must be configured via server Secrets / environment variables only.');
  }
  const cleanId = providerId.trim();
  if (!cleanId) {
    throw new Error('providerId is required.');
  }
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    sessionCredentials.delete(cleanId);
  } else {
    sessionCredentials.set(cleanId, trimmedKey);
  }
  return getCredentialStatus({
    id: cleanId,
    kind: 'openai-compatible',
    name: cleanId,
    category: 'commercial',
    enabled: true,
    defaultModelId: '',
    availableModels: [],
    capabilities: [],
    requiresCredentials: true,
    inputTypes: ['text'],
    outputTypes: ['text'],
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface ProviderTestResult {
  providerId: string;
  connected: boolean;
  status: string;
  latencyMs: number | null;
  discoveredModels: string[];
  error?: string;
  checkedAt: string;
}

export async function testAiProviderConnection(
  provider: AIProviderConfig,
  timeoutMs = 10000
): Promise<ProviderTestResult> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  const secret = readServerSecret(provider.id, provider.authEnvVarName);

  try {
    if (provider.kind === 'google-gemini') {
      if (!isGeminiConfigured()) {
        return {
          providerId: provider.id,
          connected: false,
          status: 'requires_credentials',
          latencyMs: null,
          discoveredModels: [],
          error: 'GEMINI_API_KEY is not configured in server Secrets.',
          checkedAt,
        };
      }
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY!,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const modelId = resolveGeminiModel(provider.defaultModelId);
      await ai.models.get({ model: modelId });
      return {
        providerId: provider.id,
        connected: true,
        status: 'connected',
        latencyMs: Date.now() - started,
        discoveredModels: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
        checkedAt,
      };
    }

    if (provider.kind === 'comfyui') {
      const probe = await probeComfyUiServer(provider.baseUrl, timeoutMs);
      return {
        providerId: provider.id,
        connected: probe.connected,
        status: probe.status,
        latencyMs: probe.latencyMs,
        discoveredModels: [],
        error: probe.error,
        checkedAt: probe.checkedAt,
      };
    }

    if (provider.kind === 'qwen-vl') {
      const qwen = await testQwenEndpoint(provider.baseUrl);
      return {
        providerId: provider.id,
        connected: qwen.connected,
        status: qwen.connected ? 'connected' : 'unavailable',
        latencyMs: qwen.latencyMs,
        discoveredModels: qwen.models,
        error: qwen.error,
        checkedAt,
      };
    }

    const baseCandidate =
      provider.baseUrl ||
      (provider.kind === 'openai'
        ? process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
        : provider.kind === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : provider.kind === 'ollama'
        ? process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
        : process.env.CUSTOM_OPENAI_COMPATIBLE_URL || '');

    const urlCheck = validateExternalServiceUrl(baseCandidate);
    if (!urlCheck.valid || !urlCheck.normalizedUrl) {
      return {
        providerId: provider.id,
        connected: false,
        status: 'requires_external_infrastructure',
        latencyMs: null,
        discoveredModels: [],
        error: urlCheck.error || 'Provider base URL is not configured.',
        checkedAt,
      };
    }

    if (provider.requiresCredentials && !secret) {
      return {
        providerId: provider.id,
        connected: false,
        status: 'requires_credentials',
        latencyMs: null,
        discoveredModels: [],
        error: `Missing server credential for ${provider.name}. Set ${provider.authEnvVarName || 'API key'} on server.`,
        checkedAt,
      };
    }

    if (provider.kind === 'ollama') {
      const res = await fetchWithTimeout(`${urlCheck.normalizedUrl}/api/tags`, { method: 'GET' }, timeoutMs);
      if (!res.ok) {
        return {
          providerId: provider.id,
          connected: false,
          status: 'unavailable',
          latencyMs: Date.now() - started,
          discoveredModels: [],
          error: `Ollama HTTP ${res.status}`,
          checkedAt,
        };
      }
      const json = (await res.json()) as { models?: Array<{ name: string }> };
      const discovered = (json.models || []).map((m) => m.name);
      return {
        providerId: provider.id,
        connected: true,
        status: 'connected',
        latencyMs: Date.now() - started,
        discoveredModels: discovered,
        checkedAt,
      };
    }

    if (provider.kind === 'anthropic') {
      const target = urlCheck.normalizedUrl.endsWith('/v1')
        ? `${urlCheck.normalizedUrl}/models`
        : `${urlCheck.normalizedUrl}/v1/models`;
      const res = await fetchWithTimeout(
        target,
        {
          method: 'GET',
          headers: {
            'x-api-key': secret,
            'anthropic-version': '2023-06-01',
          },
        },
        timeoutMs
      );
      if (!res.ok) {
        return {
          providerId: provider.id,
          connected: false,
          status: res.status === 401 || res.status === 403 ? 'requires_credentials' : 'unavailable',
          latencyMs: Date.now() - started,
          discoveredModels: [],
          error: `Anthropic API HTTP ${res.status}`,
          checkedAt,
        };
      }
      const json = (await res.json()) as { data?: Array<{ id: string }> };
      return {
        providerId: provider.id,
        connected: true,
        status: 'connected',
        latencyMs: Date.now() - started,
        discoveredModels: (json.data || []).map((d) => d.id),
        checkedAt,
      };
    }

    // OpenAI / OpenAI-compatible
    const modelsEndpoint = urlCheck.normalizedUrl.endsWith('/v1')
      ? `${urlCheck.normalizedUrl}/models`
      : `${urlCheck.normalizedUrl}/v1/models`;
    const headers: Record<string, string> = {};
    if (secret) headers.Authorization = `Bearer ${secret}`;

    const res = await fetchWithTimeout(modelsEndpoint, { method: 'GET', headers }, timeoutMs);
    if (!res.ok) {
      return {
        providerId: provider.id,
        connected: false,
        status: res.status === 401 || res.status === 403 ? 'requires_credentials' : 'unavailable',
        latencyMs: Date.now() - started,
        discoveredModels: [],
        error: `Endpoint HTTP ${res.status}`,
        checkedAt,
      };
    }
    const json = (await res.json()) as { data?: Array<{ id: string }> };
    return {
      providerId: provider.id,
      connected: true,
      status: 'connected',
      latencyMs: Date.now() - started,
      discoveredModels: (json.data || []).map((m) => m.id),
      checkedAt,
    };
  } catch (err) {
    return {
      providerId: provider.id,
      connected: false,
      status: 'unavailable',
      latencyMs: Date.now() - started,
      discoveredModels: [],
      error: err instanceof Error ? err.message : 'Connection test failed',
      checkedAt,
    };
  }
}

async function invokeTextProvider(input: {
  provider: AIProviderConfig;
  modelId: string;
  systemInstruction: string;
  prompt: string;
  responseJson?: boolean;
  timeoutMs: number;
}): Promise<string> {
  const secret = readServerSecret(input.provider.id, input.provider.authEnvVarName);

  if (input.provider.kind === 'google-gemini') {
    if (!isGeminiConfigured()) {
      throw new Error('GEMINI_API_KEY is not configured in server secrets.');
    }
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    const modelName = resolveGeminiModel(input.modelId);
    const response = await ai.models.generateContent({
      model: modelName,
      contents: input.prompt,
      config: {
        systemInstruction: input.systemInstruction,
        ...(input.responseJson ? { responseMimeType: 'application/json' } : {}),
      },
    });
    return (response.text ?? '').trim();
  }

  if (input.provider.kind === 'anthropic') {
    if (!secret) throw new Error('ANTHROPIC_API_KEY is missing.');
    const base = validateExternalServiceUrl(input.provider.baseUrl || 'https://api.anthropic.com/v1');
    if (!base.valid || !base.normalizedUrl) throw new Error(base.error || 'Invalid Anthropic URL');
    const url = base.normalizedUrl.endsWith('/v1')
      ? `${base.normalizedUrl}/messages`
      : `${base.normalizedUrl}/v1/messages`;

    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secret,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: input.modelId || input.provider.defaultModelId,
          max_tokens: 2048,
          system: input.systemInstruction,
          messages: [{ role: 'user', content: input.prompt }],
        }),
      },
      input.timeoutMs
    );
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Anthropic HTTP ${res.status}: ${txt.slice(0, 180)}`);
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    return (json.content || [])
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join('\n')
      .trim();
  }

  if (input.provider.kind === 'ollama') {
    const base = validateExternalServiceUrl(
      input.provider.baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
    );
    if (!base.valid || !base.normalizedUrl) throw new Error(base.error || 'Invalid Ollama URL');
    const res = await fetchWithTimeout(
      `${base.normalizedUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: input.modelId || input.provider.defaultModelId,
          stream: false,
          ...(input.responseJson ? { format: 'json' } : {}),
          messages: [
            { role: 'system', content: input.systemInstruction },
            { role: 'user', content: input.prompt },
          ],
        }),
      },
      input.timeoutMs
    );
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const json = (await res.json()) as { message?: { content?: string } };
    return (json.message?.content || '').trim();
  }

  // OpenAI / OpenAI-compatible
  const baseCandidate =
    input.provider.baseUrl ||
    (input.provider.kind === 'openai'
      ? process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
      : process.env.CUSTOM_OPENAI_COMPATIBLE_URL || '');
  const base = validateExternalServiceUrl(baseCandidate);
  if (!base.valid || !base.normalizedUrl) throw new Error(base.error || 'Invalid provider URL');
  if (input.provider.requiresCredentials && !secret) {
    throw new Error(`Missing credential for ${input.provider.name}`);
  }
  const url = base.normalizedUrl.endsWith('/v1')
    ? `${base.normalizedUrl}/chat/completions`
    : `${base.normalizedUrl}/v1/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: input.modelId || input.provider.defaultModelId,
        ...(input.responseJson ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: input.systemInstruction },
          { role: 'user', content: input.prompt },
        ],
      }),
    },
    input.timeoutMs
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${input.provider.name} HTTP ${res.status}: ${txt.slice(0, 180)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (json.choices?.[0]?.message?.content || '').trim();
}

export async function executeOrchestratedTask(input: {
  taskType: TaskType;
  prompt: string;
  systemInstruction?: string;
  responseJson?: boolean;
  providers?: AIProviderConfig[];
  models?: AIModelEntry[];
  routingRules?: TaskRoutingRule[];
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
  const providers = input.providers?.length ? input.providers : DEFAULT_AI_PROVIDERS;
  const models = input.models?.length ? input.models : DEFAULT_AI_MODELS;
  const routingRules = input.routingRules?.length ? input.routingRules : DEFAULT_TASK_ROUTING_RULES;

  const credentials = getAllCredentialStatuses(providers);
  // External URL providers like Ollama/OpenAI-compatible require explicit baseUrl; allow server attempt when configured
  const probes: Record<string, ProviderProbeSnapshot> = {};
  for (const p of providers) {
    if (
      (p.kind === 'ollama' || p.kind === 'openai-compatible' || p.kind === 'qwen-vl') &&
      Boolean((p.baseUrl || '').trim())
    ) {
      probes[p.id] = { connected: true };
    }
  }

  const resolved = resolveTaskRoute({
    taskType: input.taskType,
    providers,
    models,
    routingRules,
    credentials,
    probes,
    priority: input.priority,
    manualOverride: input.manualOverride,
  });

  if (!resolved.executable || !resolved.provider) {
    throw new Error(resolved.userNotice);
  }

  const rule = routingRules.find((r) => r.taskType === input.taskType);
  const timeoutMs = rule?.timeoutMs || 25000;
  const maxRetries = Math.min(2, rule?.maxRetries ?? 1);
  const sysPrompt =
    input.systemInstruction ||
    'You are an assistant inside a professional film, documentary, and music-video production studio.';

  const modelId = resolved.model?.modelId || resolved.provider.defaultModelId;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const outputText = await invokeTextProvider({
        provider: resolved.provider,
        modelId,
        systemInstruction: sysPrompt,
        prompt: input.prompt,
        responseJson: input.responseJson && (resolved.model?.supportsStructuredOutput ?? false),
        timeoutMs,
      });
      return {
        outputText,
        providerUsed: resolved.provider.id,
        modelUsed: modelId,
        usedFallback: resolved.usedFallback,
        fallbackReason: resolved.fallbackReason,
        userNotice: resolved.userNotice,
      };
    } catch (err) {
      lastErr = err;
    }
  }

  // If primary failed mid-flight and no manual override was forced, try secondary fallback once
  if (!input.manualOverride && rule?.fallbackProviderId && rule.fallbackProviderId !== resolved.provider.id) {
    const fb = resolveTaskRoute({
      taskType: input.taskType,
      providers,
      models,
      routingRules,
      credentials,
      probes,
      manualOverride: {
        providerId: rule.fallbackProviderId,
        modelId: rule.fallbackModelId,
      },
    });
    if (fb.executable && fb.provider) {
      const fbModel = fb.model?.modelId || fb.provider.defaultModelId;
      const reason = lastErr instanceof Error ? lastErr.message : 'Primary provider execution failed';
      const outputText = await invokeTextProvider({
        provider: fb.provider,
        modelId: fbModel,
        systemInstruction: sysPrompt,
        prompt: input.prompt,
        responseJson: input.responseJson && (fb.model?.supportsStructuredOutput ?? false),
        timeoutMs,
      });
      return {
        outputText,
        providerUsed: fb.provider.id,
        modelUsed: fbModel,
        usedFallback: true,
        fallbackReason: reason,
        userNotice: `Fallback active: ${resolved.provider.name} failed (${reason}). Completed via ${fb.provider.name}.`,
      };
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('AI orchestration request failed.');
}
