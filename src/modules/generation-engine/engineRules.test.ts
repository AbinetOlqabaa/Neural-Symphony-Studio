import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_WORKFLOW_TEMPLATES,
  ENGINE_REGISTRY,
  buildComfyE2ETestWorkflow,
  injectSceneIntoWorkflow,
  inspectEngineCapabilities,
  snapDimensionToMultiple,
  snapLtxFrameCount,
  validateComfyWorkflowJson,
  validateGenerationParams,
} from './engineRules';

test('snapLtxFrameCount enforces 8n + 1 rule', () => {
  assert.equal(snapLtxFrameCount(96), 97);
  assert.equal(snapLtxFrameCount(100), 97);
  assert.equal(snapLtxFrameCount(120), 121);
  assert.equal(snapLtxFrameCount(2), 9);
});

test('validateGenerationParams rejects invalid LTX frame count and accepts valid config', () => {
  const valid = validateGenerationParams(ENGINE_REGISTRY['ltx-video'].defaultParams);
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);

  const invalid = validateGenerationParams({
    ...ENGINE_REGISTRY['ltx-video'].defaultParams,
    frameCount: 100,
    width: 770,
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 2);
});

test('snapDimensionToMultiple snaps to 32px grid', () => {
  assert.equal(snapDimensionToMultiple(760, 32, 256, 1280), 768);
});

test('validateComfyWorkflowJson validates API workflows and explicitly flags ComfyUI UI workflows', () => {
  const valid = validateComfyWorkflowJson(DEFAULT_WORKFLOW_TEMPLATES[0].json);
  assert.equal(valid.valid, true);
  assert.equal(valid.format, 'api_workflow');
  assert.equal(valid.hasSampler, true);
  assert.equal(valid.hasPositivePrompt, true);
  assert.equal(valid.hasLoadImage, true);
  assert.equal(valid.hasOutputNode, true);

  const uiWorkflow = validateComfyWorkflowJson({
    nodes: [{ id: 1, type: 'KSampler' }],
    links: [[1, 1, 0, 2, 0, 'MODEL']],
  });
  assert.equal(uiWorkflow.valid, false);
  assert.equal(uiWorkflow.format, 'ui_workflow');
  assert.match(uiWorkflow.errors[0], /Save \(API Format\)/);
});

test('inspectEngineCapabilities detects missing LTX/Wan nodes and ready state', () => {
  const readyLtx = inspectEngineCapabilities('ltx-video', {
    checkpoints: ['ltx-video-2b-v0.9.5.safetensors'],
    unets: [],
    loras: [],
    nodeCount: 50,
    nodeTypes: ['CheckpointLoaderSimple', 'LTXVImgToVideo', 'KSampler', 'VHS_VideoCombine'],
  });
  assert.equal(readyLtx.ready, true);

  const missingWan = inspectEngineCapabilities('wan-2.1', {
    checkpoints: ['sd_xl_base.safetensors'],
    unets: [],
    loras: [],
    nodeCount: 12,
    nodeTypes: ['CheckpointLoaderSimple', 'KSampler'],
  });
  assert.equal(missingWan.ready, false);
  assert.ok(missingWan.missingNodes.includes('WanImageToVideo'));
  assert.ok(missingWan.missingModels.some((m) => m.includes('wan')));
});

test('injectSceneIntoWorkflow injects prompt, frame_rate, and sampler parameters without mutating template', () => {
  const template = DEFAULT_WORKFLOW_TEMPLATES[0].json;
  const injected = injectSceneIntoWorkflow(template, {
    positivePrompt: 'Golden hour street portrait',
    negativePrompt: 'blurry face',
    params: {
      ...ENGINE_REGISTRY['ltx-video'].defaultParams,
      seed: 999,
      steps: 40,
      fps: 24,
      frameCount: 121,
    },
    imageFilename: 'hero.png',
  }) as Record<string, { inputs: Record<string, unknown> }>;

  assert.equal(injected['3'].inputs.text, 'Golden hour street portrait');
  assert.equal(injected['4'].inputs.text, 'blurry face');
  assert.equal(injected['6'].inputs.frame_rate, 24);
  assert.equal(injected['7'].inputs.seed, 999);
  assert.equal(injected['5'].inputs.length, 121);
  assert.equal(injected['2'].inputs.image, 'hero.png');
  assert.equal((template['3'] as { inputs: Record<string, unknown> }).inputs.text, '');
});

test('buildComfyE2ETestWorkflow builds a valid API workflow', () => {
  const wf = buildComfyE2ETestWorkflow('test_model.safetensors');
  const check = validateComfyWorkflowJson(wf);
  assert.equal(check.valid, true);
  assert.equal(check.format, 'api_workflow');
});
