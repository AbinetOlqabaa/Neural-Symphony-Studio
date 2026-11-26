import type { ComfyObjectInfoSummary, EngineId, GenerationParameters, WorkflowTemplate } from '../../types/studio';

export interface EngineDefinition {
  id: EngineId;
  name: string;
  provider: string;
  targetModel: string;
  description: string;
  frameRule: '8n+1' | '4n+1' | 'any';
  dimensionMultiple: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  minFrames: number;
  maxFrames: number;
  defaultParams: GenerationParameters;
}

export const ENGINE_REGISTRY: Record<EngineId, EngineDefinition> = {
  'ltx-video': {
    id: 'ltx-video',
    name: 'LTX-Video',
    provider: 'Lightricks (via ComfyUI)',
    targetModel: 'Lightricks/LTX-Video-0.9.5',
    description: 'Fast spatiotemporal diffusion transformer requiring 8n+1 frame counts and 32px-aligned dimensions.',
    frameRule: '8n+1',
    dimensionMultiple: 32,
    minWidth: 256,
    maxWidth: 1280,
    minHeight: 256,
    maxHeight: 768,
    minFrames: 9,
    maxFrames: 257,
    defaultParams: {
      engine: 'ltx-video',
      modelName: 'Lightricks/LTX-Video-0.9.5',
      width: 768,
      height: 512,
      frameCount: 97,
      fps: 24,
      steps: 30,
      guidanceScale: 3.5,
      seed: 420194,
      motionStrength: 0.65,
    },
  },
  'wan-2.1': {
    id: 'wan-2.1',
    name: 'Wan Video',
    provider: 'Alibaba Wan (via ComfyUI)',
    targetModel: 'Wan2.1-I2V-14B-480P',
    description: 'High-coherence image-to-video adapter configured for 4n+1 frame counts and 16px-aligned resolutions.',
    frameRule: '4n+1',
    dimensionMultiple: 16,
    minWidth: 320,
    maxWidth: 1280,
    minHeight: 320,
    maxHeight: 720,
    minFrames: 17,
    maxFrames: 161,
    defaultParams: {
      engine: 'wan-2.1',
      modelName: 'Wan2.1-I2V-14B-480P',
      width: 832,
      height: 480,
      frameCount: 81,
      fps: 16,
      steps: 28,
      guidanceScale: 5.0,
      seed: 883210,
      motionStrength: 0.7,
    },
  },
  comfyui: {
    id: 'comfyui',
    name: 'ComfyUI Custom Workflow',
    provider: 'ComfyUI Execution API',
    targetModel: 'Custom Workflow Checkpoint',
    description: 'Direct ComfyUI API workflow runner supporting custom node graphs and user-imported JSON.',
    frameRule: 'any',
    dimensionMultiple: 8,
    minWidth: 256,
    maxWidth: 1920,
    minHeight: 256,
    maxHeight: 1080,
    minFrames: 1,
    maxFrames: 300,
    defaultParams: {
      engine: 'comfyui',
      modelName: 'svd_xt_1_1.safetensors',
      width: 1024,
      height: 576,
      frameCount: 25,
      fps: 24,
      steps: 25,
      guidanceScale: 4.0,
      seed: 104857,
      motionStrength: 0.55,
    },
  },
};

export function snapLtxFrameCount(rawFrames: number): number {
  const clamped = Math.max(9, Math.min(257, Math.round(rawFrames)));
  const n = Math.max(1, Math.round((clamped - 1) / 8));
  return Math.min(257, n * 8 + 1);
}

export function snapWanFrameCount(rawFrames: number): number {
  const clamped = Math.max(17, Math.min(161, Math.round(rawFrames)));
  const n = Math.max(4, Math.round((clamped - 1) / 4));
  return Math.min(161, n * 4 + 1);
}

export function snapDimensionToMultiple(value: number, multiple: number, min: number, max: number): number {
  const rounded = Math.round(value / multiple) * multiple;
  return Math.max(min, Math.min(max, rounded));
}

export function validateGenerationParams(params: GenerationParameters): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const def = ENGINE_REGISTRY[params.engine];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (params.width < def.minWidth || params.width > def.maxWidth) {
    errors.push(`Width ${params.width}px is outside ${def.name} supported range (${def.minWidth}–${def.maxWidth}px).`);
  }
  if (params.width % def.dimensionMultiple !== 0) {
    errors.push(`Width ${params.width}px must be divisible by ${def.dimensionMultiple} for ${def.name}.`);
  }
  if (params.height < def.minHeight || params.height > def.maxHeight) {
    errors.push(`Height ${params.height}px is outside ${def.name} supported range (${def.minHeight}–${def.maxHeight}px).`);
  }
  if (params.height % def.dimensionMultiple !== 0) {
    errors.push(`Height ${params.height}px must be divisible by ${def.dimensionMultiple} for ${def.name}.`);
  }
  if (params.frameCount < def.minFrames || params.frameCount > def.maxFrames) {
    errors.push(`Frame count ${params.frameCount} is outside ${def.minFrames}–${def.maxFrames}.`);
  }
  if (def.frameRule === '8n+1' && (params.frameCount - 1) % 8 !== 0) {
    errors.push(`${def.name} requires frame counts matching 8n + 1 (e.g., 25, 49, 97, 121).`);
  }
  if (def.frameRule === '4n+1' && (params.frameCount - 1) % 4 !== 0) {
    errors.push(`${def.name} requires frame counts matching 4n + 1 (e.g., 17, 49, 81).`);
  }
  if (params.steps < 1 || params.steps > 150) {
    errors.push(`Sampling steps (${params.steps}) must be between 1 and 150.`);
  }
  if (params.guidanceScale < 0 || params.guidanceScale > 30) {
    errors.push(`Guidance scale (${params.guidanceScale}) must be between 0 and 30.`);
  }
  if (params.fps < 8 || params.fps > 60) {
    warnings.push(`Unusual FPS (${params.fps}) — standard video generation uses 16–24 fps.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export interface WorkflowValidationResult {
  valid: boolean;
  format: 'api_workflow' | 'ui_workflow' | 'invalid';
  nodeCount: number;
  nodeTypes: string[];
  hasSampler: boolean;
  hasPositivePrompt: boolean;
  hasLoadImage: boolean;
  hasOutputNode: boolean;
  errors: string[];
}

export function validateComfyWorkflowJson(workflow: unknown): WorkflowValidationResult {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return {
      valid: false,
      format: 'invalid',
      nodeCount: 0,
      nodeTypes: [],
      hasSampler: false,
      hasPositivePrompt: false,
      hasLoadImage: false,
      hasOutputNode: false,
      errors: ['Workflow JSON must be an API-format object keyed by node ID.'],
    };
  }

  const record = workflow as Record<string, unknown>;
  if (Array.isArray(record.nodes) && Array.isArray(record.links)) {
    return {
      valid: false,
      format: 'ui_workflow',
      nodeCount: record.nodes.length,
      nodeTypes: [],
      hasSampler: false,
      hasPositivePrompt: false,
      hasLoadImage: false,
      hasOutputNode: false,
      errors: [
        'Detected ComfyUI Editor UI-format JSON ("nodes" / "links"). Enable Dev Mode in ComfyUI and export via "Save (API Format)" before submitting.',
      ],
    };
  }

  const entries = Object.entries(record);
  if (entries.length === 0) {
    return {
      valid: false,
      format: 'invalid',
      nodeCount: 0,
      nodeTypes: [],
      hasSampler: false,
      hasPositivePrompt: false,
      hasLoadImage: false,
      hasOutputNode: false,
      errors: ['Workflow contains zero nodes.'],
    };
  }

  const errors: string[] = [];
  const nodeTypes: string[] = [];
  let hasSampler = false;
  let hasPositivePrompt = false;
  let hasLoadImage = false;
  let hasOutputNode = false;

  for (const [nodeId, rawNode] of entries) {
    if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
      errors.push(`Node "${nodeId}" is not a valid node object.`);
      continue;
    }
    const node = rawNode as Record<string, unknown>;
    if (typeof node.class_type !== 'string' || node.class_type.trim() === '') {
      errors.push(`Node "${nodeId}" is missing a valid string "class_type".`);
    } else {
      nodeTypes.push(node.class_type);
      const lower = node.class_type.toLowerCase();
      if (lower.includes('sampler')) hasSampler = true;
      if (lower.includes('cliptextencode')) hasPositivePrompt = true;
      if (lower.includes('loadimage')) hasLoadImage = true;
      if (
        lower.includes('videocombine') ||
        lower.includes('savevideo') ||
        lower.includes('saveimage') ||
        lower.includes('saveanimated')
      ) {
        hasOutputNode = true;
      }
    }
    if (!node.inputs || typeof node.inputs !== 'object' || Array.isArray(node.inputs)) {
      errors.push(`Node "${nodeId}" is missing an "inputs" object.`);
    }
  }

  return {
    valid: errors.length === 0,
    format: errors.length === 0 ? 'api_workflow' : 'invalid',
    nodeCount: entries.length,
    nodeTypes: Array.from(new Set(nodeTypes)),
    hasSampler,
    hasPositivePrompt,
    hasLoadImage,
    hasOutputNode,
    errors,
  };
}

export interface EngineCapabilityReport {
  engine: EngineId;
  ready: boolean;
  missingNodes: string[];
  missingModels: string[];
  installedVideoOutputNodes: string[];
}

export function inspectEngineCapabilities(
  engine: EngineId,
  objectInfo: ComfyObjectInfoSummary | null
): EngineCapabilityReport {
  if (!objectInfo) {
    return {
      engine,
      ready: false,
      missingNodes: ['Connect ComfyUI to inspect /object_info nodes'],
      missingModels: ['Connect ComfyUI to inspect checkpoints/UNETs'],
      installedVideoOutputNodes: [],
    };
  }

  const installedSet = new Set(objectInfo.nodeTypes);
  const videoOutputs = ['VHS_VideoCombine', 'SaveVideo', 'SaveAnimatedWEBP', 'SaveImage'].filter((n) =>
    installedSet.has(n)
  );
  const missingNodes: string[] = [];
  const missingModels: string[] = [];

  if (engine === 'ltx-video') {
    if (!installedSet.has('LTXVImgToVideo')) missingNodes.push('LTXVImgToVideo');
    if (!installedSet.has('KSampler') && !installedSet.has('SamplerCustom')) {
      missingNodes.push('KSampler or SamplerCustom');
    }
    if (videoOutputs.length === 0) missingNodes.push('VHS_VideoCombine / SaveVideo / SaveAnimatedWEBP');
    const hasLtxModel =
      objectInfo.checkpoints.some((c) => c.toLowerCase().includes('ltx')) ||
      objectInfo.unets.some((u) => u.toLowerCase().includes('ltx'));
    if (!hasLtxModel) missingModels.push('ltx-video-*.safetensors');
  } else if (engine === 'wan-2.1') {
    if (!installedSet.has('WanImageToVideo')) missingNodes.push('WanImageToVideo');
    if (!installedSet.has('UNETLoader') && !installedSet.has('CheckpointLoaderSimple')) {
      missingNodes.push('UNETLoader or CheckpointLoaderSimple');
    }
    if (videoOutputs.length === 0) missingNodes.push('VHS_VideoCombine / SaveVideo / SaveAnimatedWEBP');
    const hasWanModel =
      objectInfo.unets.some((u) => u.toLowerCase().includes('wan')) ||
      objectInfo.checkpoints.some((c) => c.toLowerCase().includes('wan'));
    if (!hasWanModel) missingModels.push('wan2.1_i2v_*.safetensors');
  } else {
    if (!installedSet.has('KSampler')) missingNodes.push('KSampler');
  }

  return {
    engine,
    ready: missingNodes.length === 0 && missingModels.length === 0,
    missingNodes,
    missingModels,
    installedVideoOutputNodes: videoOutputs,
  };
}

export function injectSceneIntoWorkflow(
  workflowJson: Record<string, unknown>,
  options: {
    positivePrompt: string;
    negativePrompt: string;
    params: GenerationParameters;
    imageFilename?: string;
    checkpointOverride?: string;
  }
): Record<string, unknown> {
  const cloned = JSON.parse(JSON.stringify(workflowJson)) as Record<
    string,
    { class_type?: string; inputs?: Record<string, unknown>; _meta?: { title?: string } }
  >;

  for (const node of Object.values(cloned)) {
    if (!node || typeof node !== 'object' || !node.inputs) continue;
    const classType = (node.class_type || '').toLowerCase();
    const title = (node._meta?.title || '').toLowerCase();

    if (classType.includes('cliptextencode')) {
      if (title.includes('negative')) {
        node.inputs.text = options.negativePrompt;
      } else {
        node.inputs.text = options.positivePrompt;
      }
    }

    if (classType.includes('ksampler') || classType.includes('samplercustom')) {
      if ('seed' in node.inputs) node.inputs.seed = options.params.seed;
      if ('noise_seed' in node.inputs) node.inputs.noise_seed = options.params.seed;
      if ('steps' in node.inputs) node.inputs.steps = options.params.steps;
      if ('cfg' in node.inputs) node.inputs.cfg = options.params.guidanceScale;
    }

    if (classType.includes('ltxvscheduler') && 'steps' in node.inputs) {
      node.inputs.steps = options.params.steps;
    }

    if (classType.includes('ltxvconditioning') && 'frame_rate' in node.inputs) {
      node.inputs.frame_rate = options.params.fps;
    }

    if (
      classType.includes('ltxv') ||
      classType.includes('latentvideo') ||
      classType.includes('wanimagetovideo') ||
      classType.includes('emptylatentimage')
    ) {
      if ('width' in node.inputs) node.inputs.width = options.params.width;
      if ('height' in node.inputs) node.inputs.height = options.params.height;
      if ('length' in node.inputs) node.inputs.length = options.params.frameCount;
    }

    if (classType.includes('videocombine') && 'frame_rate' in node.inputs) {
      node.inputs.frame_rate = options.params.fps;
    }

    if ((classType.includes('saveanimated') || classType.includes('savevideo')) && 'fps' in node.inputs) {
      node.inputs.fps = options.params.fps;
    }

    if (classType.includes('loadimage') && options.imageFilename) {
      node.inputs.image = options.imageFilename;
    }

    if (options.checkpointOverride) {
      if (classType === 'checkpointloadersimple' && 'ckpt_name' in node.inputs) {
        node.inputs.ckpt_name = options.checkpointOverride;
      }
      if (classType === 'unetloader' && 'unet_name' in node.inputs) {
        node.inputs.unet_name = options.checkpointOverride;
      }
    }
  }

  return cloned;
}

export function buildComfyE2ETestWorkflow(checkpointName: string): Record<string, unknown> {
  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpointName },
      _meta: { title: 'Load Test Checkpoint' },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: { text: 'cinema twilight portrait warm amber streetlamp 35mm', clip: ['1', 1] },
      _meta: { title: 'Positive Prompt' },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: { text: 'blurry, low quality, watermark', clip: ['1', 1] },
      _meta: { title: 'Negative Prompt' },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: { width: 256, height: 256, batch_size: 1 },
      _meta: { title: 'Tiny E2E Latent' },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
        seed: 12345,
        steps: 4,
        cfg: 2.5,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1.0,
      },
      _meta: { title: 'Fast KSampler' },
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: { samples: ['5', 0], vae: ['1', 2] },
      _meta: { title: 'VAE Decode' },
    },
    '7': {
      class_type: 'SaveImage',
      inputs: { images: ['6', 0], filename_prefix: 'neural_symphony_e2e_test' },
      _meta: { title: 'Save E2E Test Output' },
    },
  };
}

export const DEFAULT_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'wf_ltx_i2v_095',
    name: 'LTX-Video 0.9.5 Image-to-Video',
    engine: 'ltx-video',
    description: 'Reference LTX-Video 0.9.5 ComfyUI API graph with frame-rate conditioning and 8n+1 latent sizing.',
    updatedAt: '2026-11-26T00:00:00.000Z',
    json: {
      '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'ltx-video-2b-v0.9.5.safetensors' }, _meta: { title: 'Load LTX Checkpoint' } },
      '2': { class_type: 'LoadImage', inputs: { image: 'reference_frame.png' }, _meta: { title: 'Load Reference Frame' } },
      '3': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['1', 1] }, _meta: { title: 'Positive Prompt' } },
      '4': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['1', 1] }, _meta: { title: 'Negative Prompt' } },
      '5': { class_type: 'LTXVImgToVideo', inputs: { positive: ['3', 0], negative: ['4', 0], vae: ['1', 2], image: ['2', 0], width: 768, height: 512, length: 97, batch_size: 1 }, _meta: { title: 'LTXV Image To Video' } },
      '6': { class_type: 'LTXVConditioning', inputs: { positive: ['5', 0], negative: ['5', 1], frame_rate: 24 }, _meta: { title: 'LTXV Conditioning' } },
      '7': { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['6', 0], negative: ['6', 1], latent_image: ['5', 2], seed: 420194, steps: 30, cfg: 3.5, sampler_name: 'euler', scheduler: 'normal', denoise: 1.0 }, _meta: { title: 'KSampler' } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['7', 0], vae: ['1', 2] }, _meta: { title: 'VAE Decode' } },
      '9': { class_type: 'VHS_VideoCombine', inputs: { images: ['8', 0], frame_rate: 24, format: 'video/h264-mp4', filename_prefix: 'neural_symphony_ltx' }, _meta: { title: 'Video Combine' } },
    },
  },
  {
    id: 'wf_wan21_i2v',
    name: 'Wan 2.1 Image-to-Video (480p)',
    engine: 'wan-2.1',
    description: 'Modular Wan 2.1 I2V ComfyUI API graph with 4n+1 frame conditioning.',
    updatedAt: '2026-11-26T00:00:00.000Z',
    json: {
      '1': { class_type: 'UNETLoader', inputs: { unet_name: 'wan2.1_i2v_480p_14B_fp16.safetensors' }, _meta: { title: 'Load Wan UNET' } },
      '2': { class_type: 'LoadImage', inputs: { image: 'reference_frame.png' }, _meta: { title: 'Load Reference Frame' } },
      '3': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['1', 1] }, _meta: { title: 'Positive Prompt' } },
      '4': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['1', 1] }, _meta: { title: 'Negative Prompt' } },
      '5': { class_type: 'WanImageToVideo', inputs: { positive: ['3', 0], negative: ['4', 0], start_image: ['2', 0], width: 832, height: 480, length: 81, batch_size: 1 }, _meta: { title: 'Wan Image To Video' } },
      '6': { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['5', 0], negative: ['5', 1], latent_image: ['5', 2], seed: 883210, steps: 28, cfg: 5.0, sampler_name: 'uni_pc', scheduler: 'simple', denoise: 1.0 }, _meta: { title: 'KSampler' } },
      '7': { class_type: 'VHS_VideoCombine', inputs: { images: ['6', 0], frame_rate: 16, format: 'video/h264-mp4', filename_prefix: 'neural_symphony_wan' }, _meta: { title: 'Video Combine' } },
    },
  },
];
