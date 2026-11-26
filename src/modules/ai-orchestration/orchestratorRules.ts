import type {
  AIModelEntry,
  AIProviderConfig,
  ProviderCapability,
  ProviderConnectionStatus,
  RoutingPriority,
  ServerCredentialStatus,
  StudioSettings,
  TaskRoutingRule,
  TaskType,
} from '../../types/studio';

export const DEFAULT_AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'google-gemini',
    kind: 'google-gemini',
    name: 'Google Gemini (Server Proxy)',
    category: 'commercial',
    enabled: true,
    defaultModelId: 'gemini-4-hydrogen',
    availableModels: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
    capabilities: [
      'text_generation',
      'long_form_reasoning',
      'structured_output',
      'image_understanding',
      'translation',
      'subtitle_generation',
    ],
    requiresCredentials: true,
    authEnvVarName: 'GEMINI_API_KEY',
    inputTypes: ['text', 'image'],
    outputTypes: ['text', 'json'],
    notes: 'Configured strictly via server GEMINI_API_KEY secret. Never exposed to browser.',
  },
  {
    id: 'openai',
    kind: 'openai',
    name: 'OpenAI Platform',
    category: 'commercial',
    enabled: false,
    baseUrl: 'https://api.openai.com/v1',
    defaultModelId: 'gpt-4.1-mini',
    availableModels: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini', 'o4-mini', 'gpt-image-1'],
    capabilities: [
      'text_generation',
      'long_form_reasoning',
      'structured_output',
      'image_understanding',
      'image_generation',
      'translation',
      'subtitle_generation',
    ],
    requiresCredentials: true,
    authEnvVarName: 'OPENAI_API_KEY',
    inputTypes: ['text', 'image'],
    outputTypes: ['text', 'json', 'image'],
    notes: 'Optional commercial provider. Configure OPENAI_API_KEY in server env or ephemeral session.',
  },
  {
    id: 'anthropic',
    kind: 'anthropic',
    name: 'Anthropic Claude',
    category: 'commercial',
    enabled: false,
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModelId: 'claude-sonnet-4-20250514',
    availableModels: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    capabilities: [
      'text_generation',
      'long_form_reasoning',
      'structured_output',
      'image_understanding',
      'translation',
      'subtitle_generation',
    ],
    requiresCredentials: true,
    authEnvVarName: 'ANTHROPIC_API_KEY',
    inputTypes: ['text', 'image'],
    outputTypes: ['text', 'json'],
    notes: 'Optional commercial screenplay/reasoning provider via ANTHROPIC_API_KEY.',
  },
  {
    id: 'qwen-vl',
    kind: 'qwen-vl',
    name: 'Qwen2.5-VL Vision Endpoint',
    category: 'open_source_self_hosted',
    enabled: true,
    baseUrl: '',
    defaultModelId: 'Qwen/Qwen2.5-VL-3B-Instruct',
    availableModels: ['Qwen/Qwen2.5-VL-3B-Instruct', 'Qwen/Qwen2.5-VL-7B-Instruct'],
    capabilities: ['text_generation', 'image_understanding', 'structured_output'],
    requiresCredentials: false,
    authEnvVarName: 'QWEN_VL_API_KEY',
    inputTypes: ['text', 'image'],
    outputTypes: ['text', 'json'],
    notes: 'Self-hosted or external OpenAI-compatible VLM endpoint. Requires external GPU/inference host.',
  },
  {
    id: 'ollama',
    kind: 'ollama',
    name: 'Ollama Local / Self-Hosted',
    category: 'open_source_self_hosted',
    enabled: false,
    baseUrl: 'http://127.0.0.1:11434',
    defaultModelId: 'qwen2.5:14b',
    availableModels: ['qwen2.5:14b', 'llama3.2:latest', 'gemma3:12b'],
    capabilities: ['text_generation', 'long_form_reasoning', 'translation'],
    requiresCredentials: false,
    inputTypes: ['text'],
    outputTypes: ['text'],
    notes: 'Self-hosted local inference via /api/tags and /api/chat. Does not assume vision or structured JSON unless model supports it.',
  },
  {
    id: 'openai-compatible',
    kind: 'openai-compatible',
    name: 'Custom OpenAI-Compatible (vLLM / LM Studio)',
    category: 'open_source_self_hosted',
    enabled: false,
    baseUrl: '',
    defaultModelId: 'default',
    availableModels: [],
    capabilities: ['text_generation', 'long_form_reasoning', 'translation'],
    requiresCredentials: false,
    authEnvVarName: 'CUSTOM_OPENAI_COMPATIBLE_KEY',
    inputTypes: ['text'],
    outputTypes: ['text'],
    notes: 'Any self-hosted /v1/models + /v1/chat/completions endpoint.',
  },
  {
    id: 'comfyui',
    kind: 'comfyui',
    name: 'ComfyUI GPU Backend',
    category: 'specialized',
    enabled: true,
    baseUrl: 'http://127.0.0.1:8188',
    defaultModelId: 'Lightricks/LTX-Video-0.9.5',
    availableModels: ['Lightricks/LTX-Video-0.9.5', 'Wan2.1-I2V-14B-480P'],
    capabilities: ['image_generation', 'image_to_video'],
    requiresCredentials: false,
    authEnvVarName: 'COMFYUI_API_TOKEN',
    inputTypes: ['image', 'text', 'workflow_json'],
    outputTypes: ['image', 'video'],
    notes: 'Requires external NVIDIA GPU ComfyUI server (--listen). Offline Simulation Mode available for workflow testing.',
  },
];

export const DEFAULT_AI_MODELS: AIModelEntry[] = [
  {
    id: 'model_gemini_hydrogen',
    providerId: 'google-gemini',
    modelId: 'gemini-4-hydrogen',
    displayName: 'Gemini 4 Hydrogen',
    category: 'text_language',
    capabilities: [
      'text_generation',
      'long_form_reasoning',
      'structured_output',
      'image_understanding',
      'translation',
      'subtitle_generation',
    ],
    supportsImageInput: true,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    contextWindowTokens: 1000000,
    qualityTier: 'balanced',
    cost: {
      classification: 'free_tier',
      currency: 'USD',
      licensingNotes: 'Managed Google API. Free tier / quota managed via AI Studio Secrets.',
    },
    supportedLanguages: ['en', 'am', 'om', 'ti'],
    notes: 'Default balanced multimodal + structured JSON studio model.',
  },
  {
    id: 'model_gemini_flash_lite',
    providerId: 'google-gemini',
    modelId: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
    category: 'text_language',
    capabilities: [
      'text_generation',
      'structured_output',
      'image_understanding',
      'translation',
      'subtitle_generation',
    ],
    supportsImageInput: true,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    contextWindowTokens: 1000000,
    qualityTier: 'low_cost',
    cost: {
      classification: 'free_tier',
      currency: 'USD',
      licensingNotes: 'Fast low-latency Gemini tier.',
    },
    supportedLanguages: ['en', 'am', 'om', 'ti'],
  },
  {
    id: 'model_openai_gpt41',
    providerId: 'openai',
    modelId: 'gpt-4.1',
    displayName: 'OpenAI GPT-4.1',
    category: 'text_language',
    capabilities: [
      'text_generation',
      'long_form_reasoning',
      'structured_output',
      'image_understanding',
      'translation',
      'subtitle_generation',
    ],
    supportsImageInput: true,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    contextWindowTokens: 1000000,
    qualityTier: 'preferred_quality',
    cost: {
      classification: 'paid_api',
      currency: 'USD',
      licensingNotes: 'Commercial API billing per token; configure optional user rate estimates if tracking spend.',
    },
    supportedLanguages: ['en', 'am', 'om', 'ti'],
  },
  {
    id: 'model_openai_gpt41_mini',
    providerId: 'openai',
    modelId: 'gpt-4.1-mini',
    displayName: 'OpenAI GPT-4.1 Mini',
    category: 'text_language',
    capabilities: [
      'text_generation',
      'structured_output',
      'image_understanding',
      'translation',
      'subtitle_generation',
    ],
    supportsImageInput: true,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    qualityTier: 'low_cost',
    cost: {
      classification: 'paid_api',
      currency: 'USD',
      licensingNotes: 'Lower-cost OpenAI tier; configure verified rates manually if desired.',
    },
    supportedLanguages: ['en', 'am', 'om', 'ti'],
  },
  {
    id: 'model_anthropic_sonnet4',
    providerId: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    category: 'text_language',
    capabilities: [
      'text_generation',
      'long_form_reasoning',
      'structured_output',
      'image_understanding',
      'translation',
    ],
    supportsImageInput: true,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    contextWindowTokens: 200000,
    qualityTier: 'preferred_quality',
    cost: {
      classification: 'paid_api',
      currency: 'USD',
      licensingNotes: 'Anthropic commercial API.',
    },
    supportedLanguages: ['en', 'am', 'om', 'ti'],
  },
  {
    id: 'model_qwen_25_vl',
    providerId: 'qwen-vl',
    modelId: 'Qwen/Qwen2.5-VL-3B-Instruct',
    displayName: 'Qwen2.5-VL-3B-Instruct',
    category: 'image_understanding',
    capabilities: ['text_generation', 'image_understanding', 'structured_output'],
    supportsImageInput: true,
    supportsStructuredOutput: true,
    supportsToolCalling: false,
    qualityTier: 'local_offline',
    cost: {
      classification: 'local_self_hosted',
      currency: 'USD',
      licensingNotes: 'Open-weight license; requires external GPU hosting/compute cost.',
    },
    supportedLanguages: ['en'],
  },
  {
    id: 'model_ollama_qwen25',
    providerId: 'ollama',
    modelId: 'qwen2.5:14b',
    displayName: 'Ollama Qwen 2.5 14B',
    category: 'text_language',
    capabilities: ['text_generation', 'long_form_reasoning', 'translation'],
    supportsImageInput: false,
    supportsStructuredOutput: false,
    supportsToolCalling: false,
    qualityTier: 'local_offline',
    cost: {
      classification: 'local_self_hosted',
      currency: 'USD',
      licensingNotes: 'Open-weight model run locally on your hardware/GPU; electricity & hardware hosting apply.',
    },
    supportedLanguages: ['en'],
  },
  {
    id: 'model_comfy_image_workflow',
    providerId: 'comfyui',
    modelId: 'ComfyUI/Image-Workflow',
    displayName: 'ComfyUI Still / Storyboard Workflow (Flux / SDXL)',
    category: 'image_generation',
    capabilities: ['image_generation'],
    supportsImageInput: true,
    supportsStructuredOutput: false,
    supportsToolCalling: false,
    qualityTier: 'local_offline',
    cost: {
      classification: 'local_self_hosted',
      currency: 'USD',
      licensingNotes: 'Requires ComfyUI GPU workstation with image checkpoint/FLUX nodes.',
    },
    supportedLanguages: ['en'],
  },
  {
    id: 'model_comfy_ltx095',
    providerId: 'comfyui',
    modelId: 'Lightricks/LTX-Video-0.9.5',
    displayName: 'LTX-Video 0.9.5',
    category: 'video_generation',
    capabilities: ['image_to_video'],
    supportsImageInput: true,
    supportsStructuredOutput: false,
    supportsToolCalling: false,
    qualityTier: 'local_offline',
    cost: {
      classification: 'local_self_hosted',
      currency: 'USD',
      licensingNotes: 'Requires ComfyUI GPU workstation or Colab tunnel.',
    },
    supportedLanguages: ['en'],
  },
  {
    id: 'model_comfy_wan21',
    providerId: 'comfyui',
    modelId: 'Wan2.1-I2V-14B-480P',
    displayName: 'Wan 2.1 I2V 14B',
    category: 'video_generation',
    capabilities: ['image_to_video'],
    supportsImageInput: true,
    supportsStructuredOutput: false,
    supportsToolCalling: false,
    qualityTier: 'local_offline',
    cost: {
      classification: 'local_self_hosted',
      currency: 'USD',
      licensingNotes: 'Requires ComfyUI GPU server with Wan UNET weights.',
    },
    supportedLanguages: ['en'],
  },
];

export const DEFAULT_TASK_ROUTING_RULES: TaskRoutingRule[] = [
  {
    taskType: 'screenplay_development',
    label: 'Screenplay & Creative Development',
    description: 'Long-form creative briefs, loglines, treatments, screenplay scenes, and production breakdowns.',
    requiredCapabilities: ['text_generation', 'long_form_reasoning'],
    primaryProviderId: 'google-gemini',
    primaryModelId: 'gemini-4-hydrogen',
    fallbackProviderId: 'anthropic',
    fallbackModelId: 'claude-sonnet-4-20250514',
    priority: 'quality',
    timeoutMs: 30000,
    maxRetries: 1,
    allowManualOverride: true,
    allowOfflineSimulation: false,
  },
  {
    taskType: 'image_analysis',
    label: 'Reference Image Understanding',
    description: 'Observable subject, wardrobe, lighting, and camera perspective extraction from stills.',
    requiredCapabilities: ['image_understanding', 'structured_output'],
    primaryProviderId: 'google-gemini',
    primaryModelId: 'gemini-4-hydrogen',
    fallbackProviderId: 'qwen-vl',
    fallbackModelId: 'Qwen/Qwen2.5-VL-3B-Instruct',
    priority: 'quality',
    timeoutMs: 25000,
    maxRetries: 1,
    allowManualOverride: true,
    allowOfflineSimulation: false,
  },
  {
    taskType: 'prompt_synthesis',
    label: 'Engine-Adapted Prompt Synthesis',
    description: 'Translating character and scene bibles into LTX-Video 0.9.5 and Wan 2.1 prompt structures.',
    requiredCapabilities: ['text_generation', 'structured_output'],
    primaryProviderId: 'google-gemini',
    primaryModelId: 'gemini-3.1-flash-lite',
    fallbackProviderId: 'openai',
    fallbackModelId: 'gpt-4.1-mini',
    priority: 'speed',
    timeoutMs: 20000,
    maxRetries: 1,
    allowManualOverride: true,
    allowOfflineSimulation: false,
  },
  {
    taskType: 'storyboard_image_creation',
    label: 'Storyboard Image Creation',
    description: 'Generating or conditioning still storyboard reference frames.',
    requiredCapabilities: ['image_generation'],
    primaryProviderId: 'comfyui',
    primaryModelId: 'ComfyUI/Image-Workflow',
    fallbackProviderId: 'openai',
    fallbackModelId: 'gpt-image-1',
    priority: 'local',
    timeoutMs: 45000,
    maxRetries: 1,
    allowManualOverride: true,
    allowOfflineSimulation: true,
  },
  {
    taskType: 'image_to_video',
    label: 'Image-to-Video Generation',
    description: 'Animating approved reference stills and prompts into temporal video clips.',
    requiredCapabilities: ['image_to_video'],
    primaryProviderId: 'comfyui',
    primaryModelId: 'Lightricks/LTX-Video-0.9.5',
    priority: 'local',
    timeoutMs: 60000,
    maxRetries: 0,
    allowManualOverride: true,
    allowOfflineSimulation: true,
  },
  {
    taskType: 'localization',
    label: 'Multilingual Script & Dialogue Localization',
    description: 'English, Amharic (አማርኛ), Afaan Oromoo, and Tigrigna (ትግርኛ) translation and subtitle adaptation.',
    requiredCapabilities: ['text_generation', 'translation'],
    primaryProviderId: 'google-gemini',
    primaryModelId: 'gemini-4-hydrogen',
    fallbackProviderId: 'openai',
    fallbackModelId: 'gpt-4.1',
    priority: 'quality',
    timeoutMs: 25000,
    maxRetries: 1,
    allowManualOverride: true,
    allowOfflineSimulation: false,
  },
  {
    taskType: 'voice_generation',
    label: 'Narration & Voice Generation',
    description: 'Spoken narration synthesis (no verified Tigrigna/Amharic TTS provider configured by default).',
    requiredCapabilities: ['text_to_speech'],
    primaryProviderId: '',
    primaryModelId: '',
    priority: 'quality',
    timeoutMs: 30000,
    maxRetries: 0,
    allowManualOverride: true,
    allowOfflineSimulation: false,
  },
];

export interface ProviderProbeSnapshot {
  connected: boolean;
  checkedAt?: string;
  latencyMs?: number | null;
  error?: string;
}

export function evaluateProviderStatus(
  provider: AIProviderConfig,
  credential?: ServerCredentialStatus,
  probe?: ProviderProbeSnapshot
): ProviderConnectionStatus {
  if (!provider.enabled) {
    return provider.kind === 'comfyui' ? 'offline_simulation' : 'unavailable';
  }

  if (provider.kind === 'comfyui' || provider.kind === 'qwen-vl' || provider.kind === 'ollama' || provider.kind === 'openai-compatible') {
    const hasUrl = Boolean((provider.baseUrl || '').trim());
    if (!hasUrl && provider.kind !== 'ollama') {
      return 'requires_external_infrastructure';
    }
    if (probe) {
      return probe.connected ? 'connected' : 'unavailable';
    }
    return hasUrl ? 'requires_external_infrastructure' : 'unavailable';
  }

  if (provider.requiresCredentials && !credential?.hasCredential) {
    return 'requires_credentials';
  }

  if (probe) {
    return probe.connected ? 'connected' : 'unavailable';
  }
  return 'configured';
}

export function isStatusExecutable(status: ProviderConnectionStatus): boolean {
  return status === 'connected' || status === 'configured' || status === 'available';
}

export interface RouteResolutionResult {
  executable: boolean;
  provider?: AIProviderConfig;
  model?: AIModelEntry;
  status: ProviderConnectionStatus;
  usedFallback: boolean;
  usedSimulation: boolean;
  fallbackReason?: string;
  userNotice: string;
}

function modelSupportsCapabilities(
  provider: AIProviderConfig,
  model: AIModelEntry | undefined,
  required: ProviderCapability[]
): boolean {
  const caps = new Set<ProviderCapability>(model ? model.capabilities : provider.capabilities);
  return required.every((cap) => caps.has(cap));
}

function scoreModelForPriority(model: AIModelEntry | undefined, priority: RoutingPriority): number {
  if (!model) return 0;
  switch (priority) {
    case 'local':
      return model.cost.classification === 'local_self_hosted' ? 100 : model.cost.classification === 'free_tier' ? 40 : 10;
    case 'cost':
      if (model.cost.classification === 'local_self_hosted') return 95;
      if (model.cost.classification === 'free_tier') return 90;
      if (model.qualityTier === 'low_cost') return 70;
      return 20;
    case 'speed':
      if (model.qualityTier === 'low_cost') return 90;
      if (model.qualityTier === 'balanced') return 70;
      return 40;
    case 'quality':
    default:
      if (model.qualityTier === 'preferred_quality') return 100;
      if (model.qualityTier === 'balanced') return 80;
      if (model.qualityTier === 'low_cost') return 55;
      return 40;
  }
}

export function resolveTaskRoute(input: {
  taskType: TaskType;
  providers: AIProviderConfig[];
  models: AIModelEntry[];
  routingRules: TaskRoutingRule[];
  credentials: Record<string, ServerCredentialStatus>;
  probes?: Record<string, ProviderProbeSnapshot>;
  priority?: RoutingPriority;
  manualOverride?: { providerId: string; modelId?: string };
}): RouteResolutionResult {
  const rule =
    input.routingRules.find((r) => r.taskType === input.taskType) ||
    DEFAULT_TASK_ROUTING_RULES.find((r) => r.taskType === input.taskType);

  if (!rule) {
    return {
      executable: false,
      status: 'unavailable',
      usedFallback: false,
      usedSimulation: false,
      userNotice: `No routing policy found for task "${input.taskType}".`,
    };
  }

  const effectivePriority = input.priority || rule.priority;
  const checkCandidate = (providerId?: string, modelId?: string) => {
    if (!providerId) return null;
    const provider = input.providers.find((p) => p.id === providerId);
    if (!provider) return null;
    const status = evaluateProviderStatus(provider, input.credentials[provider.id], input.probes?.[provider.id]);
    const model = input.models.find((m) => m.providerId === provider.id && m.modelId === (modelId || provider.defaultModelId));
    const capable = modelSupportsCapabilities(provider, model, rule.requiredCapabilities);
    return { provider, model, status, capable };
  };

  const formatStatusPhrase = (status: ProviderConnectionStatus): string => {
    switch (status) {
      case 'requires_credentials':
        return 'requires credentials';
      case 'requires_external_infrastructure':
        return 'requires external infrastructure';
      case 'offline_simulation':
        return 'is in offline simulation mode';
      default:
        return `is ${status.replace(/_/g, ' ')}`;
    }
  };

  if (input.manualOverride?.providerId) {
    const manual = checkCandidate(input.manualOverride.providerId, input.manualOverride.modelId);
    if (!manual) {
      return {
        executable: false,
        status: 'unavailable',
        usedFallback: false,
        usedSimulation: false,
        userNotice: `Selected provider "${input.manualOverride.providerId}" does not exist.`,
      };
    }
    if (!manual.capable) {
      return {
        executable: false,
        provider: manual.provider,
        model: manual.model,
        status: 'unavailable',
        usedFallback: false,
        usedSimulation: false,
        userNotice: `${manual.provider.name} lacks required capabilities (${rule.requiredCapabilities.join(', ')}).`,
      };
    }
    if (!isStatusExecutable(manual.status)) {
      return {
        executable: false,
        provider: manual.provider,
        model: manual.model,
        status: manual.status,
        usedFallback: false,
        usedSimulation: false,
        userNotice: `${manual.provider.name} ${formatStatusPhrase(manual.status)}.`,
      };
    }
    return {
      executable: true,
      provider: manual.provider,
      model: manual.model,
      status: manual.status,
      usedFallback: false,
      usedSimulation: false,
      userNotice: `Manual selection: ${manual.provider.name} (${manual.model?.modelId || manual.provider.defaultModelId}).`,
    };
  }

  // 1. Try primary candidate
  const primary = checkCandidate(rule.primaryProviderId, rule.primaryModelId);
  if (primary && primary.capable && isStatusExecutable(primary.status)) {
    return {
      executable: true,
      provider: primary.provider,
      model: primary.model,
      status: primary.status,
      usedFallback: false,
      usedSimulation: false,
      userNotice: `Routed to primary provider ${primary.provider.name} (${primary.model?.modelId || primary.provider.defaultModelId}).`,
    };
  }

  const primaryBlockReason = primary
    ? !primary.capable
      ? `${primary.provider.name} lacks required capability`
      : `${primary.provider.name} ${formatStatusPhrase(primary.status)}`
    : 'No primary provider configured';

  // 2. Try explicit secondary fallback
  const fallback = checkCandidate(rule.fallbackProviderId, rule.fallbackModelId);
  if (fallback && fallback.capable && isStatusExecutable(fallback.status)) {
    return {
      executable: true,
      provider: fallback.provider,
      model: fallback.model,
      status: fallback.status,
      usedFallback: true,
      usedSimulation: false,
      fallbackReason: primaryBlockReason,
      userNotice: `Fallback active: ${primaryBlockReason}. Switched to ${fallback.provider.name} (${fallback.model?.modelId || fallback.provider.defaultModelId}).`,
    };
  }

  // 3. Rank all compatible enabled+ready providers by priority
  const compatibleReady = input.providers
    .map((p) => {
      const status = evaluateProviderStatus(p, input.credentials[p.id], input.probes?.[p.id]);
      const matchingModel = input.models
        .filter((m) => m.providerId === p.id && modelSupportsCapabilities(p, m, rule.requiredCapabilities))
        .sort((a, b) => scoreModelForPriority(b, effectivePriority) - scoreModelForPriority(a, effectivePriority))[0];
      const capable = matchingModel
        ? true
        : modelSupportsCapabilities(p, undefined, rule.requiredCapabilities);
      return { provider: p, model: matchingModel, status, capable };
    })
    .filter((entry) => entry.capable && isStatusExecutable(entry.status))
    .sort((a, b) => scoreModelForPriority(b.model, effectivePriority) - scoreModelForPriority(a.model, effectivePriority));

  if (compatibleReady.length > 0) {
    const chosen = compatibleReady[0];
    return {
      executable: true,
      provider: chosen.provider,
      model: chosen.model,
      status: chosen.status,
      usedFallback: true,
      usedSimulation: false,
      fallbackReason: primaryBlockReason,
      userNotice: `Fallback active (${effectivePriority} priority): ${primaryBlockReason}. Using ${chosen.provider.name}.`,
    };
  }

  // 4. Explicit offline simulation notice if task allows simulation (never pretending it is a real LLM)
  if (rule.allowOfflineSimulation) {
    return {
      executable: false,
      status: 'offline_simulation',
      usedFallback: true,
      usedSimulation: true,
      fallbackReason: primaryBlockReason,
      userNotice: `External provider unavailable (${primaryBlockReason}). Offline Simulation Mode available for workflow testing.`,
    };
  }

  return {
    executable: false,
    status: primary?.status || 'requires_credentials',
    usedFallback: false,
    usedSimulation: false,
    fallbackReason: primaryBlockReason,
    userNotice: `${rule.label} unavailable: ${primaryBlockReason}. Author manually or configure a compatible provider.`,
  };
}

export function sanitizeSettingsForClientExport(settings: StudioSettings): StudioSettings {
  const cleanProviders = (settings.aiProviders || []).map((p) => {
    const clone: Record<string, unknown> = { ...p };
    delete clone.apiKey;
    delete clone.secret;
    delete clone.token;
    return clone as unknown as AIProviderConfig;
  });
  return {
    ...settings,
    aiProviders: cleanProviders,
  };
}
