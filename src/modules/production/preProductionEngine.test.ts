import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoProject } from '../../data/demoProject';
import { migrateProjectSchema } from '../persistence/projectMigration';
import {
  applyBreakdownDraftToScene,
  buildShotFromStoryboardFrame,
  exportShotListAsCsv,
  exportShotListAsMarkdown,
  exportShotListAsPrintableHtml,
  exportStoryboardContactSheetHtml,
  extractBreakdownDraftFromScreenplay,
  normalizeCharacterEntry,
  parseSluglineMetadata,
  removeCostumeSafely,
  removeLocationSafely,
  removePropSafely,
  removeShotSafely,
  removeStoryboardFrameSafely,
  reorderStoryboardFramesForScene,
  revertCharacterToVersion,
  snapshotCharacterVersion,
} from './preProductionEngine';

test('Character Bible normalization, version snapshot, and safe revert preserve history', () => {
  const demo = migrateProjectSchema(createDemoProject());
  const baseChar = normalizeCharacterEntry(demo.characters[0]);
  const v2 = snapshotCharacterVersion(
    { ...baseChar, hairstyle: 'Braided crown updo', approved: true },
    'Updated chorus hair styling'
  );
  assert.equal(v2.version, 2);
  assert.equal(v2.versionHistory?.length, 1);

  const edited = { ...v2, hairstyle: 'Temporary placeholder hair' };
  const reverted = revertCharacterToVersion(edited, 2);
  assert.equal(reverted.hairstyle, 'Braided crown updo');
  assert.equal(reverted.approved, false);
});

test('Storyboard reordering and Shot conversion preserve scene linkage', () => {
  const demo = migrateProjectSchema(createDemoProject());
  const sceneId = demo.scenes[0].id;
  const f1 = {
    id: 'sb_1',
    sceneId,
    frameNumber: 1,
    shotNumber: '1A',
    visualDescription: 'Synth panel close-up',
    cameraAngle: 'Eye Level',
    shotSize: 'Close-Up',
    cameraMovement: 'Dolly',
    lighting: 'Warm tungsten',
    action: 'Lamp illuminates dials',
    durationSec: 2,
    generationPrompt: 'Close-up synth',
    approved: false,
  };
  const f2 = {
    ...f1,
    id: 'sb_2',
    frameNumber: 2,
    shotNumber: '1B',
    visualDescription: 'Condenser microphone reveal',
  };

  const reordered = reorderStoryboardFramesForScene([f1, f2], sceneId, 'sb_2', 'up');
  assert.equal(reordered[0].id, 'sb_2');
  assert.equal(reordered[0].frameNumber, 1);
  assert.equal(reordered[1].id, 'sb_1');
  assert.equal(reordered[1].frameNumber, 2);

  const shot = buildShotFromStoryboardFrame(reordered[0]);
  assert.equal(shot.sceneId, sceneId);
  assert.equal(shot.storyboardFrameId, 'sb_2');
  assert.equal(shot.shotSize, 'Close-Up');
});

test('Deterministic screenplay breakdown extraction parses sluglines and matches entities non-destructively', () => {
  const demo = migrateProjectSchema(createDemoProject());
  const parsed = parseSluglineMetadata('INT./EXT. ADDIS SKYLINE ROOFTOP - BLUE HOUR');
  assert.equal(parsed.interiorExterior, 'INT/EXT');
  assert.equal(parsed.locationLabel, 'ADDIS SKYLINE ROOFTOP');
  assert.equal(parsed.timeOfDay, 'BLUE HOUR');

  const scr = (demo.screenplay || [])[1];
  const draft = extractBreakdownDraftFromScreenplay(scr, demo);
  assert.equal(draft.matchedCharacterIds.includes('char_selam_lead'), true);

  const updatedScene = applyBreakdownDraftToScene(demo.scenes[1], draft);
  assert.equal(updatedScene.sourceScreenplayId, scr.id);
  assert.equal(updatedScene.sourceScreenplayVersion, scr.revision);
});

test('Safe deletions clear dangling foreign keys across scenes, storyboards, and shots', () => {
  const demo = migrateProjectSchema(createDemoProject());
  const withRefs = {
    ...demo,
    costumes: [
      {
        id: 'cost_test',
        characterId: 'char_selam_lead',
        sceneIds: ['scene_verse_street'],
        garmentDescription: 'Coat',
        fabric: 'Wool',
        color: 'Charcoal',
        pattern: 'Solid',
        accessories: '',
        footwear: 'Boots',
        culturalContext: '',
        continuityNotes: '',
        approved: false,
      },
    ],
    locations: [
      {
        id: 'loc_test',
        name: 'Avenue',
        sceneIds: ['scene_verse_street'],
        architecturalStyle: 'Modern',
        environmentDescription: 'Street',
        timeOfDay: 'Dusk',
        weather: 'Clear',
        lighting: 'Amber',
        continuityNotes: '',
      },
    ],
    props: [
      {
        id: 'prop_test',
        name: 'Mic',
        characterIds: ['char_selam_lead'],
        sceneIds: ['scene_verse_street'],
        locationId: 'loc_test',
        description: 'Dynamic mic',
      },
    ],
    storyboardFrames: [
      {
        id: 'sb_test',
        sceneId: 'scene_verse_street',
        shotNumber: '2A',
        visualDescription: 'Vocalist sings',
        cameraAngle: 'Eye Level',
        shotSize: 'Medium Close-Up',
        cameraMovement: 'Dolly',
        lighting: 'Amber',
        action: 'Singing',
        durationSec: 4,
        locationId: 'loc_test',
        costumeIds: ['cost_test'],
        propIds: ['prop_test'],
        generationPrompt: 'Prompt',
        approved: false,
      },
    ],
    shotList: [
      {
        id: 'shot_test',
        sceneId: 'scene_verse_street',
        storyboardFrameId: 'sb_test',
        shotNumber: '2A',
        shotSize: 'Medium Close-Up',
        cameraAngle: 'Eye Level',
        cameraMovement: 'Dolly',
        lensGuidance: '50mm',
        propIds: ['prop_test'],
        costumeIds: ['cost_test'],
        durationSec: 4,
        approved: false,
      },
    ],
    scenes: demo.scenes.map((s) =>
      s.id === 'scene_verse_street'
        ? { ...s, locationId: 'loc_test', costumeIds: ['cost_test'], propIds: ['prop_test'] }
        : s
    ),
  };

  const afterCostume = removeCostumeSafely(withRefs, 'cost_test');
  assert.equal(afterCostume.costumes?.length, 0);
  assert.equal(afterCostume.scenes.find((s) => s.id === 'scene_verse_street')?.costumeIds?.length, 0);

  const afterLoc = removeLocationSafely(afterCostume, 'loc_test');
  assert.equal(afterLoc.locations?.length, 0);
  assert.equal(afterLoc.props?.[0].locationId, undefined);

  const afterProp = removePropSafely(afterLoc, 'prop_test');
  assert.equal(afterProp.props?.length, 0);
  assert.equal(afterProp.shotList?.[0].propIds?.length, 0);

  const afterSb = removeStoryboardFrameSafely(afterProp, 'sb_test');
  assert.equal(afterSb.shotList?.[0].storyboardFrameId, undefined);

  const afterShot = removeShotSafely(afterSb, 'shot_test');
  assert.equal(afterShot.shotList?.length, 0);
});

test('Shot List and Storyboard Contact Sheet exporters format CSV, Markdown, and escaped HTML cleanly', () => {
  const demo = migrateProjectSchema(createDemoProject());
  const withShots = {
    ...demo,
    shotList: [
      {
        id: 'sh_1',
        sceneId: demo.scenes[0].id,
        shotNumber: '1A',
        description: 'Synth <script>alert(1)</script> pan',
        shotSize: 'Close-Up',
        cameraAngle: 'Eye Level',
        cameraMovement: 'Dolly',
        lensGuidance: '50mm',
        durationSec: 4,
        approved: true,
      },
    ],
  };

  const csv = exportShotListAsCsv(withShots);
  assert.match(csv, /Shot Number/);
  assert.match(csv, /"1A"/);

  const md = exportShotListAsMarkdown(withShots);
  assert.match(md, /\| 1A \|/);

  const html = exportShotListAsPrintableHtml(withShots);
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.match(html, /&lt;script&gt;/);

  const contactHtml = exportStoryboardContactSheetHtml(withShots);
  assert.match(contactHtml, /Storyboard Contact Sheet/);
});
