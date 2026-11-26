import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeCharacterImpact,
  analyzeProjectContinuity,
  analyzeScreenplayImpact,
} from './continuityEngine';
import { createDemoProject } from '../../data/demoProject';
import { migrateProjectSchema } from '../persistence/projectMigration';

test('continuityEngine detects unreviewed screenplay edits, missing references, broken Phase C links, and preserves manual reports', () => {
  const base = migrateProjectSchema(createDemoProject());

  const modified = {
    ...base,
    screenplay: (base.screenplay || []).map((s) =>
      s.linkedSceneId === 'scene_verse_street' ? { ...s, approved: false, revision: 2 } : s
    ),
    shotList: [
      ...(base.shotList || []),
      {
        id: 'shot_broken_sb',
        sceneId: 'scene_verse_street',
        storyboardFrameId: 'nonexistent_frame_99',
        shotNumber: '9Z',
        shotSize: 'Close-Up',
        cameraAngle: 'Eye Level',
        cameraMovement: 'Static',
        lensGuidance: '50mm',
        durationSec: 3,
        approved: false,
      },
    ],
    scenes: base.scenes.map((sc) =>
      sc.id === 'scene_verse_street'
        ? { ...sc, locationId: 'missing_location_404', characterIds: ['char_selam_lead', 'missing_char_77'] }
        : sc
    ),
    continuityAlerts: [
      {
        id: 'manual_wardrobe_check',
        severity: 'warning' as const,
        category: 'costume' as const,
        source: 'manual' as const,
        title: 'Verify silver hoop earrings in rooftop shot',
        description: 'Manual director check requested.',
        affectedEntityIds: ['char_selam_lead', 'scene_chorus_rooftop'],
        createdAt: '2026-11-26T00:00:00Z',
        resolved: false,
      },
    ],
  };

  const alerts = analyzeProjectContinuity(modified);
  assert.equal(alerts.some((a) => a.source === 'manual' && a.id === 'manual_wardrobe_check'), true);
  assert.equal(
    alerts.some((a) => a.category === 'screenplay' && a.affectedEntityIds.includes('scene_verse_street')),
    true
  );
  assert.equal(
    alerts.some((a) => a.id === 'cont_shot_missing_sb_shot_broken_sb' && a.classification === 'critical'),
    true
  );
  assert.equal(
    alerts.some((a) => a.id === 'cont_scene_missing_loc_scene_verse_street' && a.classification === 'critical'),
    true
  );
  assert.equal(
    alerts.some((a) => a.id === 'cont_scene_missing_char_scene_verse_street_missing_char_77'),
    true
  );

  const charImpact = analyzeCharacterImpact(modified, 'char_selam_lead');
  assert.equal(charImpact.affectedSceneIds.includes('scene_verse_street'), true);
  assert.equal(charImpact.affectedSceneIds.includes('scene_chorus_rooftop'), true);

  const scrId = modified.screenplay?.find((s) => s.linkedSceneId === 'scene_verse_street')?.id || '';
  const scrImpact = analyzeScreenplayImpact(modified, scrId);
  assert.equal(scrImpact.affectedSceneIds.includes('scene_verse_street'), true);
});
