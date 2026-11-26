import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_TASK_ROUTING_RULES,
  evaluateProviderStatus,
  resolveTaskRoute,
  sanitizeSettingsForClientExport,
} from './orchestratorRules';
import type { ServerCredentialStatus } from '../../types/studio';

test('evaluateProviderStatus distinguishes credentials, external infra, and connected states honestly', () => {
  const gemini = DEFAULT_AI_PROVIDERS.find((p) => p.id === 'google-gemini')!;
  const openai = DEFAULT_AI_PROVIDERS.find((p) => p.id === 'openai')!;
  const comfy = DEFAULT_AI_PROVIDERS.find((p) => p.id === 'comfyui')!;

  assert.equal(
    evaluateProviderStatus(gemini, { providerId: 'google-gemini', hasCredential: false, source: 'none' }),
    'requires_credentials'
  );
  assert.equal(
    evaluateProviderStatus(gemini, { providerId: 'google-gemini', hasCredential: true, source: 'env' }),
    'configured'
  );
  assert.equal(evaluateProviderStatus(openai), 'unavailable'); // disabled by default
  assert.equal(evaluateProviderStatus(comfy), 'requires_external_infrastructure');
  assert.equal(evaluateProviderStatus(comfy, undefined, { connected: true }), 'connected');
});

test('resolveTaskRoute falls back transparently when primary provider lacks credentials', () => {
  const providers = DEFAULT_AI_PROVIDERS.map((p) =>
    p.id === 'openai' ? { ...p, enabled: true } : p
  );
  const credentials: Record<string, ServerCredentialStatus> = {
    'google-gemini': { providerId: 'google-gemini', hasCredential: false, source: 'none' },
    openai: { providerId: 'openai', hasCredential: true, source: 'session_memory' },
  };

  const route = resolveTaskRoute({
    taskType: 'screenplay_development',
    providers,
    models: DEFAULT_AI_MODELS,
    routingRules: DEFAULT_TASK_ROUTING_RULES,
    credentials,
    priority: 'quality',
  });

  assert.equal(route.executable, true);
  assert.equal(route.provider?.id, 'openai');
  assert.equal(route.usedFallback, true);
  assert.match(route.userNotice, /Fallback active/i);
});

test('resolveTaskRoute rejects unverified Tigrigna/voice TTS and prevents incompatible model routing', () => {
  const credentials: Record<string, ServerCredentialStatus> = {
    'google-gemini': { providerId: 'google-gemini', hasCredential: true, source: 'env' },
  };

  // Voice generation has no configured TTS provider
  const voiceRoute = resolveTaskRoute({
    taskType: 'voice_generation',
    providers: DEFAULT_AI_PROVIDERS,
    models: DEFAULT_AI_MODELS,
    routingRules: DEFAULT_TASK_ROUTING_RULES,
    credentials,
  });
  assert.equal(voiceRoute.executable, false);

  // Manual override to Ollama for image_analysis should fail capability check (no image_understanding)
  const providersWithOllama = DEFAULT_AI_PROVIDERS.map((p) =>
    p.id === 'ollama' ? { ...p, enabled: true } : p
  );
  const incompatibleManual = resolveTaskRoute({
    taskType: 'image_analysis',
    providers: providersWithOllama,
    models: DEFAULT_AI_MODELS,
    routingRules: DEFAULT_TASK_ROUTING_RULES,
    credentials,
    manualOverride: { providerId: 'ollama', modelId: 'qwen2.5:14b' },
  });
  assert.equal(incompatibleManual.executable, false);
  assert.match(incompatibleManual.userNotice, /lacks required capabilities/i);
});

test('sanitizeSettingsForClientExport strips any accidental secret properties', () => {
  const dirty = {
    theme: 'dark' as const,
    comfyUiUrl: 'http://127.0.0.1:8188',
    comfyTimeoutMs: 8000,
    qwenVlEndpointUrl: '',
    qwenVlModelId: 'Qwen/Qwen2.5-VL-3B-Instruct',
    geminiModel: 'gemini-4-hydrogen',
    ffmpegServiceUrl: '',
    defaultEngine: 'ltx-video' as const,
    autosaveSeconds: 3,
    allowOfflineSimulation: true,
    aiProviders: [
      {
        ...DEFAULT_AI_PROVIDERS[1],
        apiKey: 'sk-should-never-survive',
        token: 'secret-token',
      } as unknown as typeof DEFAULT_AI_PROVIDERS[1],
    ],
  };

  const clean = sanitizeSettingsForClientExport(dirty);
  const serialized = JSON.stringify(clean);
  assert.equal(serialized.includes('sk-should-never-survive'), false);
  assert.equal(serialized.includes('secret-token'), false);
});
