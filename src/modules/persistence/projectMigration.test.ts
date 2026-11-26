import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  migrateProjectSchema,
  sanitizeProjectForPortableExport,
} from './projectMigration';
import type { Project } from '../../types/studio';

const legacyV1Project: Project = {
  id: 'proj_legacy_v1',
  name: 'Legacy Ethiopia MV',
  description: 'Original v1 project record without creativeBrief or screenplay.',
  createdAt: '2026-11-25T10:00:00Z',
  updatedAt: '2026-11-25T10:00:00Z',
  status: 'in_production',
  settings: { defaultEngine: 'ltx-video', defaultWidth: 768, defaultHeight: 512, defaultFps: 24 },
  mediaAssets: [],
  analyses: {},
  characters: [
    {
      id: 'c1',
      name: 'Hanna',
      label: 'Lead',
      referenceAssetIds: [],
      distinguishingCharacteristics: 'Braided hair, white netela',
      facialDescription: 'Warm expression',
      hairstyle: 'Braided',
      clothing: 'White traditional netela',
      accessories: 'Silver cross',
      approximateAgeCategory: '20s',
      typicalPose: 'Standing',
      appearanceConstraints: 'Keep netela',
      identityPreservationInstructions: 'Keep braids',
      associatedAssetIds: [],
      associatedSceneIds: ['s1'],
      matchConfidence: 0.9,
      needsHumanReview: false,
      reviewedByHuman: true,
    },
  ],
  scenes: [
    {
      id: 's1',
      order: 1,
      title: '01. Courtyard Dawn',
      description: 'Hanna walks through morning courtyard.',
      referenceAssetIds: [],
      characterIds: ['c1'],
      environmentDescription: 'Stone courtyard',
      composition: 'Medium shot',
      cameraFraming: 'Medium',
      lighting: 'Golden dawn',
      motionDirection: 'Slow walk',
      cameraMovement: 'Dolly in',
      durationSeconds: 4,
      narrativePurpose: 'Opening',
      positivePrompt: 'Hanna courtyard dawn',
      negativePrompt: 'blur',
      selectedEngine: 'ltx-video',
      generationSettings: {
        engine: 'ltx-video',
        modelName: 'LTX',
        width: 768,
        height: 512,
        frameCount: 97,
        fps: 24,
        steps: 24,
        guidanceScale: 3.5,
        seed: 100,
        motionStrength: 0.6,
      },
      status: 'approved',
      approvedForGeneration: true,
    },
  ],
  promptHistory: [],
  jobs: [],
  clips: [],
  lyrics: [],
  timeline: { fps: 24, resolutionWidth: 1920, resolutionHeight: 1080, blocks: [], showLyricsOverlay: true, zoomLevel: 1 },
  workflows: [],
  exportSettings: { format: 'mp4', width: 1920, height: 1080, fps: 24, videoBitrateMbps: 12, includeAudio: true, burnSubtitles: true },
  extraMetadata: {
    preservedCustomNote: 'keep-me',
    openaiApiKey: 'sk-should-be-stripped',
  },
};

test('migrateProjectSchema upgrades v1 projects non-destructively and links screenplay scenes', () => {
  const migrated = migrateProjectSchema(legacyV1Project);
  assert.equal(migrated.schemaVersion, CURRENT_PROJECT_SCHEMA_VERSION);
  assert.equal(migrated.scenes.length, 1);
  assert.equal(migrated.characters[0].name, 'Hanna');
  assert.ok(migrated.creativeBrief);
  assert.equal(migrated.screenplay?.length, 1);
  assert.equal(migrated.screenplay?.[0].linkedSceneId, 's1');
  assert.ok((migrated.productionDocuments?.length || 0) >= 3);
  assert.equal(migrated.languageConfig?.targetLanguages.includes('ti'), true);
});

test('sanitizeProjectForPortableExport strips accidental secret keys while preserving unknown metadata', () => {
  const safe = sanitizeProjectForPortableExport(legacyV1Project);
  assert.equal(safe.extraMetadata?.preservedCustomNote, 'keep-me');
  assert.equal('openaiApiKey' in (safe.extraMetadata || {}), false);
});
