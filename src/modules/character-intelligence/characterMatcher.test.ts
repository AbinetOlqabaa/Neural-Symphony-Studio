import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCharacterMatch, mergeCharacters, splitCharacterAsset } from './characterMatcher';
import type { CharacterEntry, ImageAnalysis } from '../../types/studio';

const baseChar: CharacterEntry = {
  id: 'char_a',
  name: 'Selam',
  label: 'Vocalist',
  referenceAssetIds: ['asset_1', 'asset_2'],
  primaryReferenceAssetId: 'asset_1',
  distinguishingCharacteristics: 'Braided crown and wool coat',
  facialDescription: 'Expressive dark eyes, warm complexion',
  hairstyle: 'Curly braided crown',
  clothing: 'Dark charcoal wool coat',
  accessories: 'Silver earrings',
  approximateAgeCategory: '20s',
  typicalPose: 'Singing into mic',
  appearanceConstraints: 'Keep charcoal coat',
  identityPreservationInstructions: 'Keep earrings and braids',
  associatedAssetIds: ['asset_1', 'asset_2'],
  associatedSceneIds: ['scene_1'],
  matchConfidence: 1,
  needsHumanReview: false,
  reviewedByHuman: true,
};

const analysis: ImageAnalysis = {
  assetId: 'asset_3',
  provider: 'gemini',
  modelName: 'gemini-4-hydrogen',
  analyzedAt: '2026-11-26T00:00:00Z',
  description: 'Woman in charcoal wool coat with curly braided crown',
  visualAttributes: {
    mainSubjects: ['Female singer'],
    humanSubjects: 'Young woman with braided crown',
    clothing: 'Dark charcoal wool coat',
    hairstyle: 'Curly braided crown',
    facialCharacteristics: 'Expressive dark eyes',
    pose: 'Standing',
    bodyOrientation: 'Three-quarter profile',
    environment: 'City rooftop',
    background: 'City skyline',
    lighting: 'Blue hour twilight',
    cameraPerspective: 'Eye level',
    composition: 'Rule of thirds',
    objects: ['Microphone'],
    colors: ['Slate blue', 'Charcoal'],
    visualStyle: '35mm film',
    emotionalExpression: 'Reflective',
    imageQuality: 'Sharp',
  },
  identifiedSubjects: ['Female singer'],
  confidence: 0.88,
  suggestedSceneCategories: ['Chorus'],
  suggestedCinematicTreatment: 'Slow dolly',
  userEdited: false,
};

test('evaluateCharacterMatch flags moderate/uncertain matches for human review', () => {
  const candidates = evaluateCharacterMatch(analysis, [baseChar]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].characterId, 'char_a');
  assert.equal(candidates[0].requiresHumanReview, true);
});

test('mergeCharacters and splitCharacterAsset preserve asset associations safely', () => {
  const second: CharacterEntry = { ...baseChar, id: 'char_b', name: 'Selam Alt', referenceAssetIds: ['asset_9'], associatedAssetIds: ['asset_9'] };
  const merged = mergeCharacters([baseChar, second], 'char_a', 'char_b');
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].referenceAssetIds, ['asset_1', 'asset_2', 'asset_9']);

  const split = splitCharacterAsset(merged, 'char_a', 'asset_2', 'Backup Vocalist');
  assert.equal(split.length, 2);
  assert.equal(split[0].referenceAssetIds.includes('asset_2'), false);
  assert.deepEqual(split[1].referenceAssetIds, ['asset_2']);
});
