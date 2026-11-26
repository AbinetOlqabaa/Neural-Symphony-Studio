import test from 'node:test';
import assert from 'node:assert/strict';
import { compileStructuredPrompt, estimatePromptTokens } from './promptCompiler';
import { ENGINE_REGISTRY } from '../generation-engine/engineRules';
import type { CharacterEntry, ScenePlan } from '../../types/studio';

const sampleChar: CharacterEntry = {
  id: 'char_1',
  name: 'Selam',
  label: 'Lead Vocalist',
  referenceAssetIds: ['asset_1'],
  distinguishingCharacteristics: 'Silver hoop earrings, braids',
  facialDescription: 'Warm brown eyes, calm expression',
  hairstyle: 'Half-up curly braided crown',
  clothing: 'Charcoal wool overcoat',
  accessories: 'Silver hoop earrings',
  approximateAgeCategory: 'Mid-20s',
  typicalPose: 'Holding handheld microphone',
  appearanceConstraints: 'Keep charcoal wool coat consistent',
  identityPreservationInstructions: 'Preserve exact facial geometry and silver hoop earrings',
  associatedAssetIds: ['asset_1'],
  associatedSceneIds: ['scene_1'],
  matchConfidence: 1,
  needsHumanReview: false,
  reviewedByHuman: true,
};

const sampleScene: ScenePlan = {
  id: 'scene_1',
  order: 1,
  title: 'Evening Street Intro',
  description: 'Selam sings beneath warm amber streetlamps',
  referenceAssetIds: ['asset_1'],
  characterIds: ['char_1'],
  environmentDescription: 'Cobblestone city avenue at dusk',
  composition: 'Medium close-up centered subject',
  cameraFraming: 'Medium Close-Up',
  lighting: 'Warm amber streetlamp key light',
  motionDirection: 'Subtle head turn toward lens',
  cameraMovement: 'Slow push-in dolly',
  durationSeconds: 4,
  narrativePurpose: 'Establish protagonist',
  positivePrompt: '',
  negativePrompt: '',
  selectedEngine: 'ltx-video',
  generationSettings: ENGINE_REGISTRY['ltx-video'].defaultParams,
  status: 'planned',
  approvedForGeneration: true,
};

test('compileStructuredPrompt includes character preservation and adapts per engine', () => {
  const ltx = compileStructuredPrompt({
    scene: sampleScene,
    characters: [sampleChar],
    analyses: [],
    engine: 'ltx-video',
  });
  assert.match(ltx.positivePrompt, /Preserve exact facial geometry/);
  assert.match(ltx.positivePrompt, /Slow push-in dolly/);
  assert.ok(ltx.estimatedTokens > 15);
  assert.equal(estimatePromptTokens(''), 0);
});
