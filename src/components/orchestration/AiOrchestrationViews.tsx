import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import {
  evaluateProviderStatus,
  isStatusExecutable,
} from '../../modules/ai-orchestration/orchestratorRules';
import type {
  AIProviderConfig,
  ProviderConnectionStatus,
  ProviderKind,
  RoutingPriority,
} from '../../types/studio';

function statusBadgeText(status: ProviderConnectionStatus): { label: string; colorClass: string } {
  switch (status) {
    case 'connected':
      return { label: 'Connected', colorClass: 'text-[var(--ns-success)]' };
    case 'configured':
    case 'available':
      return { label: 'Configured', colorClass: 'text-[var(--ns-success)]' };
    case 'offline_simulation':
      return { label: 'Offline Simulation', colorClass: 'text-[var(--ns-accent-blue)]' };
    case 'requires_credentials':
      return { label: 'Requires Credentials', colorClass: 'text-[var(--ns-warning)]' };
    case 'requires_external_infrastructure':
      return { label: 'Requires External Host', colorClass: 'text-[var(--ns-warning)]' };
    default:
      return { label: 'Unavailable', colorClass: 'text-[var(--ns-text-muted)]' };
  }
}

export function AiProvidersView({
  store,
  embedded = false,
}: {
  store: StudioStore;
  embedded?: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<ProviderKind>('openai-compatible');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      store.notify('error', 'Provider name is required.');
      return;
    }
    const id = `custom_${Date.now().toString(36)}`;
    const newProvider: AIProviderConfig = {
      id,
      kind: newKind,
      name: newName.trim(),
      category: 'open_source_self_hosted',
      enabled: true,
      baseUrl: newBaseUrl.trim(),
      defaultModelId: newModelId.trim() || 'default',
      availableModels: newModelId.trim() ? [newModelId.trim()] : [],
      capabilities: ['text_generation', 'long_form_reasoning', 'translation'],
      requiresCredentials: false,
      inputTypes: ['text'],
      outputTypes: ['text'],
      notes: 'Custom user-configured endpoint',
      isCustom: true,
    };
    await store.upsertAiProvider(newProvider);
    setNewName('');
    setNewBaseUrl('');
    setNewModelId('');
    setAddOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          {embedded ? (
            <h2 className="font-display text-base font-semibold">AI Providers & Model Configuration</h2>
          ) : (
            <h1 className="font-display text-xl font-semibold">AI Providers & Model Configuration</h1>
          )}
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Configure commercial, open-source, and self-hosted AI backends. Zero credentials are required to start or use manual pre-production tools.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void store.refreshProviderCredentials()}
            className="h-8 px-3 rounded border border-[var(--ns-border)] text-xs inline-flex items-center gap-1.5 hover:bg-[var(--ns-surface-elevated)]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Credential Status</span>
          </button>
          <button
            type="button"
            onClick={() => setAddOpen((o) => !o)}
            className="h-8 px-3 rounded bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Provider</span>
          </button>
        </div>
      </div>

      {/* Security Boundary Banner */}
      <div className="p-3.5 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-[var(--ns-success)] shrink-0 mt-0.5" />
        <div className="space-y-1 text-[var(--ns-text-muted)]">
          <div className="font-medium text-[var(--ns-text)]">Server-Side Credential Isolation</div>
          <p>
            API keys never touch browser JavaScript, IndexedDB, localStorage, or exported `.nss.zip` archives.
            `GEMINI_API_KEY` is read exclusively from AI Studio Secrets (`process.env`). Optional third-party keys entered below reside strictly in server memory for this live session (configure `.env` for persistent deployment).
          </p>
        </div>
      </div>

      {addOpen && (
        <form
          onSubmit={(e) => void handleAddProvider(e)}
          className="p-4 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] space-y-3 text-xs"
        >
          <h3 className="font-display text-sm font-semibold">Add Custom OpenAI-Compatible or Ollama Provider</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label htmlFor="add-prov-name" className="block text-[var(--ns-text-muted)]">
                Provider Name
              </label>
              <input
                id="add-prov-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Local vLLM Studio"
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="add-prov-kind" className="block text-[var(--ns-text-muted)]">
                Adapter Protocol
              </label>
              <select
                id="add-prov-kind"
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as ProviderKind)}
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="openai-compatible">OpenAI-Compatible (/v1)</option>
                <option value="ollama">Ollama (/api/tags)</option>
                <option value="qwen-vl">Qwen Vision Endpoint</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="add-prov-url" className="block text-[var(--ns-text-muted)]">
                API Base URL
              </label>
              <input
                id="add-prov-url"
                type="url"
                value={newBaseUrl}
                onChange={(e) => setNewBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000/v1"
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="add-prov-model" className="block text-[var(--ns-text-muted)]">
                Default Model ID
              </label>
              <input
                id="add-prov-model"
                type="text"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                placeholder="Qwen/Qwen2.5-14B-Instruct"
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="h-8 px-3 rounded border border-[var(--ns-border)] text-[var(--ns-text-muted)]"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 px-3.5 rounded bg-[var(--ns-accent)] text-white font-medium">
              Save Provider
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4">
        {store.aiProviders.map((provider) => {
          const cred = store.providerCredentials[provider.id];
          const probe = store.providerProbes[provider.id];
          const status = evaluateProviderStatus(provider, cred, probe);
          const badge = statusBadgeText(status);
          const isGemini = provider.kind === 'google-gemini';

          return (
            <section
              key={provider.id}
              className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={(e) => void store.upsertAiProvider({ ...provider, enabled: e.target.checked })}
                      aria-label={`Enable ${provider.name}`}
                    />
                    <span className="font-display text-sm font-semibold">{provider.name}</span>
                  </label>
                  <span className="text-[var(--ns-text-subtle)]">·</span>
                  <span className="text-[var(--ns-text-muted)]">{provider.category.replace(/_/g, ' ')}</span>
                  <span className="text-[var(--ns-text-subtle)]">·</span>
                  <span className={`font-medium ${badge.colorClass}`}>{badge.label}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={testingId === provider.id}
                    onClick={async () => {
                      setTestingId(provider.id);
                      try {
                        await store.probeAiProvider(provider);
                      } finally {
                        setTestingId(null);
                      }
                    }}
                    className="h-8 px-3 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)] font-medium"
                  >
                    {testingId === provider.id ? 'Testing...' : 'Test Connection'}
                  </button>
                  {provider.isCustom && (
                    <button
                      type="button"
                      aria-label={`Remove ${provider.name}`}
                      onClick={() => void store.deleteAiProvider(provider.id)}
                      className="h-8 px-2 rounded border border-[var(--ns-border)] text-[var(--ns-danger)] hover:bg-[var(--ns-danger)]/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {provider.kind !== 'google-gemini' && (
                  <div className="md:col-span-5 space-y-1">
                    <label className="block text-[var(--ns-text-muted)]">Base Endpoint URL</label>
                    <input
                      type="url"
                      value={provider.baseUrl || ''}
                      onChange={(e) =>
                        void store.upsertAiProvider({ ...provider, baseUrl: e.target.value })
                      }
                      placeholder={
                        provider.kind === 'ollama'
                          ? 'http://127.0.0.1:11434'
                          : provider.kind === 'comfyui'
                          ? 'http://127.0.0.1:8188'
                          : 'https://...'
                      }
                      className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
                    />
                  </div>
                )}

                <div className={provider.kind === 'google-gemini' ? 'md:col-span-6 space-y-1' : 'md:col-span-4 space-y-1'}>
                  <label className="block text-[var(--ns-text-muted)]">Preferred Model Identifier</label>
                  <input
                    type="text"
                    value={provider.defaultModelId}
                    onChange={(e) =>
                      void store.upsertAiProvider({ ...provider, defaultModelId: e.target.value })
                    }
                    className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
                  />
                </div>

                <div className={provider.kind === 'google-gemini' ? 'md:col-span-6 space-y-1' : 'md:col-span-3 space-y-1'}>
                  <span className="block text-[var(--ns-text-muted)]">Server Credential State</span>
                  <div className="h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] flex items-center justify-between font-mono text-[11px]">
                    <span>{provider.authEnvVarName || 'Optional / Local'}</span>
                    <span className={cred?.hasCredential ? 'text-[var(--ns-success)]' : 'text-[var(--ns-text-subtle)]'}>
                      {cred?.hasCredential ? `Active (${cred.source})` : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Session credential entry ONLY for optional non-Gemini providers */}
              {!isGemini && (provider.requiresCredentials || provider.authEnvVarName) && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                  <div className="flex-1 flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-[var(--ns-text-subtle)] shrink-0" />
                    <input
                      type="password"
                      value={keyDrafts[provider.id] || ''}
                      onChange={(e) => setKeyDrafts((d) => ({ ...d, [provider.id]: e.target.value }))}
                      placeholder={`Session API key for ${provider.name} (stored strictly in server memory; leave blank or use ${provider.authEnvVarName || 'env'})`}
                      autoComplete="off"
                      className="flex-1 h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const val = keyDrafts[provider.id] || '';
                      await store.saveProviderSecret(provider.id, val);
                      setKeyDrafts((d) => ({ ...d, [provider.id]: '' }));
                    }}
                    className="h-8 px-3 rounded border border-[var(--ns-border)] bg-[var(--ns-surface-elevated)] hover:border-[var(--ns-border-strong)] whitespace-nowrap"
                  >
                    Apply Session Key
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--ns-text-subtle)]">
                <span>
                  Capabilities: {provider.capabilities.map((c) => c.replace(/_/g, ' ')).join(' · ')}
                </span>
                {probe?.error && <span className="text-[var(--ns-danger)]">{probe.error}</span>}
                {probe?.connected && (
                  <span className="text-[var(--ns-success)] tabular-nums">
                    Verified {probe.latencyMs ?? 0}ms · {probe.discoveredModels?.length || 0} model(s) discovered
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function ModelRoutingView({ store }: { store: StudioStore }) {
  const priority = store.settings.routingPriority || 'quality';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Task-Based Model Routing</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Assign primary and fallback models per production task based on verified capability compatibility. Fallbacks always notify clearly and never silently downgrade quality.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="global-routing-priority" className="text-[var(--ns-text-muted)]">
            Global Priority
          </label>
          <select
            id="global-routing-priority"
            value={priority}
            onChange={(e) => void store.setRoutingPriority(e.target.value as RoutingPriority)}
            className="h-9 px-3 rounded bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          >
            <option value="quality">1. Quality</option>
            <option value="cost">2. Cost</option>
            <option value="speed">3. Speed</option>
            <option value="local">4. Local Execution</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {store.routingRules.map((rule) => {
          const resolution = store.resolveTaskPreview(rule.taskType);

          return (
            <section
              key={rule.taskType}
              className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4 text-xs"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm font-semibold flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[var(--ns-accent)]" />
                    <span>{rule.label}</span>
                  </h2>
                  <p className="text-[var(--ns-text-muted)] mt-0.5">{rule.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  {resolution.executable && !resolution.usedFallback ? (
                    <span className="inline-flex items-center gap-1 text-[var(--ns-success)] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Primary Ready</span>
                    </span>
                  ) : resolution.executable && resolution.usedFallback ? (
                    <span className="inline-flex items-center gap-1 text-[var(--ns-warning)] font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Fallback Active</span>
                    </span>
                  ) : (
                    <span className="text-[var(--ns-text-muted)] font-medium">
                      {resolution.status.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-[11px] flex flex-wrap items-center justify-between gap-2">
                <span className={resolution.usedFallback ? 'text-[var(--ns-warning)]' : 'text-[var(--ns-text-muted)]'}>
                  {resolution.userNotice}
                </span>
                <span className="text-[var(--ns-text-subtle)]">
                  Required: {rule.requiredCapabilities.map((c) => c.replace(/_/g, ' ')).join(' · ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-3 space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Primary Provider</label>
                  <select
                    value={rule.primaryProviderId}
                    onChange={(e) => {
                      const nextProv = store.aiProviders.find((p) => p.id === e.target.value);
                      void store.updateRoutingRule({
                        ...rule,
                        primaryProviderId: e.target.value,
                        primaryModelId: nextProv?.defaultModelId || '',
                      });
                    }}
                    className="w-full h-8 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    <option value="">None configured</option>
                    {store.aiProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Primary Model</label>
                  <input
                    type="text"
                    value={rule.primaryModelId}
                    onChange={(e) =>
                      void store.updateRoutingRule({ ...rule, primaryModelId: e.target.value })
                    }
                    className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
                  />
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Secondary Fallback Provider</label>
                  <select
                    value={rule.fallbackProviderId || ''}
                    onChange={(e) => {
                      const nextProv = store.aiProviders.find((p) => p.id === e.target.value);
                      void store.updateRoutingRule({
                        ...rule,
                        fallbackProviderId: e.target.value || undefined,
                        fallbackModelId: nextProv?.defaultModelId || undefined,
                      });
                    }}
                    className="w-full h-8 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    <option value="">No fallback</option>
                    {store.aiProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[var(--ns-text-muted)]">Timeout (ms)</label>
                    <input
                      type="number"
                      min={3000}
                      max={120000}
                      step={1000}
                      value={rule.timeoutMs}
                      onChange={(e) =>
                        void store.updateRoutingRule({
                          ...rule,
                          timeoutMs: Math.max(3000, Number(e.target.value) || 25000),
                        })
                      }
                      className="w-full h-8 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[var(--ns-text-muted)]">Retries</label>
                    <input
                      type="number"
                      min={0}
                      max={3}
                      value={rule.maxRetries}
                      onChange={(e) =>
                        void store.updateRoutingRule({
                          ...rule,
                          maxRetries: Math.max(0, Math.min(3, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-full h-8 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {rule.taskType === 'voice_generation' && !isStatusExecutable(resolution.status) && (
                <p className="text-[11px] text-[var(--ns-text-subtle)]">
                  Honesty Note: High-quality Tigrigna (ትግርኛ), Amharic, or Afaan Oromoo TTS is not marked available until a dedicated verified voice provider is configured and tested.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
