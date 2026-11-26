import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { createDemoProject } from '../../data/demoProject';
import { analyzeProjectContinuity } from '../continuity/continuityEngine';
import {
  exportProjectToZipBlob,
  importProjectFromZipBuffer,
} from '../persistence/projectArchive';
import {
  renderBreakdownMarkdown,
  renderCharacterBibleMarkdown,
  renderCompletePreProductionPackageMarkdown,
  renderCostumeBibleMarkdown,
  renderLocationBibleMarkdown,
  renderProductionScheduleMarkdown,
  renderPropsListMarkdown,
  renderShotListMarkdown,
  renderStoryboardMarkdown,
} from './documentSystem';
import {
  applyBreakdownDraftToScene,
  buildShotFromStoryboardFrame,
  exportShotListAsCsv,
  exportShotListAsJson,
  exportShotListAsMarkdown,
  exportShotListAsPrintableHtml,
  exportStoryboardContactSheetHtml,
  extractBreakdownDraftFromScreenplay,
  normalizeCharacterEntry,
  removeLocationSafely,
  reorderStoryboardFramesForScene,
  snapshotCharacterVersion,
} from './preProductionEngine';
import type {
  CostumeSpec,
  LocationSpec,
  ProductionTask,
  PropSpec,
  Project,
  ScreenplaySceneSection,
  StoryboardFrameSpec,
} from '../../types/studio';

test('Miniature Production E2E: screenplay -> breakdown -> bibles -> storyboard -> shots -> schedule -> continuity -> ZIP roundtrip', async () => {
  const base = createDemoProject();

  // 1. 3 screenplay scenes with multilingual Unicode (Amharic + Tigrigna + Afaan Oromoo + English)
  const screenplay: ScreenplaySceneSection[] = [
    {
      id: 'sp_e2e_1',
      order: 1,
      linkedSceneId: 'sc_e2e_1',
      actNumber: 1,
      sequenceName: 'Act I',
      slugline: 'EXT. ADDIS ROOFTOP - NIGHT',
      sceneType: 'music_video',
      actionDescription: 'Selam walks across wet concrete holding the brass condenser mic. Dawit plays masinko under neon glow.',
      narration: 'Tigrigna subtitle test: ሰላም ኣብ ከተማ ኣዲስ ኣበባ።',
      dialogueBlocks: [
        {
          id: 'dlg_1',
          characterId: 'ch_e2e_1',
          speakerName: 'Selam',
          language: 'am',
          text: 'ሌሊቱ ገና አልጀመረም።',
        },
      ],
      estimatedDurationSec: 12,
      revision: 1,
      approved: true,
      updatedAt: new Date().toISOString(),
      versionHistory: [],
    },
    {
      id: 'sp_e2e_2',
      order: 2,
      linkedSceneId: 'sc_e2e_2',
      actNumber: 1,
      sequenceName: 'Act I',
      slugline: 'EXT. ADDIS ROOFTOP - DAY',
      sceneType: 'music_video',
      actionDescription: 'Morning mist clears over Piassa rooftops. Oromo refrain: Halkan Finfinnee keessaa.',
      narration: '',
      dialogueBlocks: [],
      estimatedDurationSec: 10,
      revision: 1,
      approved: false,
      updatedAt: new Date().toISOString(),
      versionHistory: [],
    },
    {
      id: 'sp_e2e_3',
      order: 3,
      linkedSceneId: 'sc_e2e_3',
      actNumber: 2,
      sequenceName: 'Act II',
      slugline: 'INT. BUNNA CAFE - NIGHT',
      sceneType: 'screenplay',
      actionDescription: 'Warm coffee ceremony smoke curls around the brass kettle and ceramic sini cups.',
      narration: '',
      dialogueBlocks: [],
      estimatedDurationSec: 14,
      revision: 1,
      approved: true,
      updatedAt: new Date().toISOString(),
      versionHistory: [],
    },
  ];

  // 2. 2 Characters with normalized Character Bible & version snapshot
  const char1 = snapshotCharacterVersion(
    normalizeCharacterEntry({
      ...base.characters[0],
      id: 'ch_e2e_1',
      name: 'Selam',
      characterCategory: 'lead',
      approved: true,
    }),
    'Approved lead look'
  );
  const char2 = normalizeCharacterEntry({
    ...base.characters[1],
    id: 'ch_e2e_2',
    name: 'Dawit',
    characterCategory: 'supporting',
    approved: false,
  });

  // 3. 2 Locations
  const locations: LocationSpec[] = [
    {
      id: 'loc_e2e_1',
      name: 'Piassa Neon Rooftop',
      sceneIds: ['sc_e2e_1', 'sc_e2e_2'],
      locationType: 'real_world',
      interiorExterior: 'EXT',
      architecturalStyle: 'Mid-century Addis concrete terrace',
      environmentDescription: 'Wet concrete terrace overlooking streetlamps.',
      timeOfDay: 'Night',
      weather: 'Post-rain mist',
      lighting: 'Cyan & amber practicals',
      continuityNotes: 'Keep skyline east-facing.',
      approved: true,
    },
    {
      id: 'loc_e2e_2',
      name: 'Bunna Heritage Cafe',
      sceneIds: ['sc_e2e_3'],
      locationType: 'studio',
      interiorExterior: 'INT',
      architecturalStyle: 'Warm timber & plaster interior',
      environmentDescription: 'Intimate coffee nook with woven baskets.',
      timeOfDay: 'Night',
      weather: 'Dry interior',
      lighting: '2700K tungsten practicals',
      continuityNotes: 'Maintain warm tungsten key.',
      approved: true,
    },
  ];

  // 4. 2 Costumes
  const costumes: CostumeSpec[] = [
    {
      id: 'cost_e2e_1',
      name: 'Selam Emerald Silk Coat',
      characterId: 'ch_e2e_1',
      sceneIds: ['sc_e2e_1', 'sc_e2e_3'],
      garmentDescription: 'Emerald trench over white hand-woven cotton dress.',
      fabric: 'Silk & Habesha cotton',
      color: 'Emerald & Ivory',
      pattern: 'Tibeb gold trim',
      accessories: 'Silver filigree earrings',
      footwear: 'Black leather boots',
      culturalContext: 'Contemporary Addis Ababa fashion',
      continuityNotes: 'Collar turned up in exterior night scene.',
      approved: true,
    },
    {
      id: 'cost_e2e_2',
      name: 'Dawit Linen Studio Jacket',
      characterId: 'ch_e2e_2',
      sceneIds: ['sc_e2e_1'],
      garmentDescription: 'Charcoal linen jacket over black mock-neck.',
      fabric: 'Linen blend',
      color: 'Charcoal',
      pattern: 'Matte weave',
      accessories: 'Wristwatch',
      footwear: 'Suede boots',
      culturalContext: 'Urban musician wardrobe',
      continuityNotes: 'Sleeves unrolled.',
      approved: true,
    },
  ];

  // 5. 3 Props including multi-scene state change
  const props: PropSpec[] = [
    {
      id: 'prop_e2e_1',
      name: 'Vintage Brass Condenser Mic',
      category: 'narrative_object',
      characterIds: ['ch_e2e_1'],
      sceneIds: ['sc_e2e_1', 'sc_e2e_3'],
      locationId: 'loc_e2e_1',
      description: 'Brushed brass microphone on heavy chrome stand.',
      narrativeImportance: 'hero',
      sceneStates: [
        { sceneId: 'sc_e2e_1', stateLabel: 'Mounted on rain-flecked stand', conditionNotes: 'Water droplets on grille' },
        { sceneId: 'sc_e2e_3', stateLabel: 'Wrapped in velvet pouch on table', conditionNotes: 'Dry & coiled cable' },
      ],
      approved: true,
    },
    {
      id: 'prop_e2e_2',
      name: 'Traditional Masinko',
      category: 'handheld',
      characterIds: ['ch_e2e_2'],
      sceneIds: ['sc_e2e_1'],
      locationId: 'loc_e2e_1',
      description: 'Single-string bowed lute with carved tuning peg.',
      narrativeImportance: 'hero',
      approved: true,
    },
    {
      id: 'prop_e2e_3',
      name: 'Brass Coffee Kettle (Jebena Tray)',
      category: 'set_decoration',
      characterIds: [],
      sceneIds: ['sc_e2e_3'],
      locationId: 'loc_e2e_2',
      description: 'Polished brass tray with porcelain sini cups.',
      narrativeImportance: 'featured',
      approved: false,
    },
  ];

  // 6. Scene breakdowns derived cleanly from screenplay
  let project: Project = {
    ...base,
    id: 'proj_mini_e2e',
    name: 'Miniature Pre-Prod Test (አዲስ)',
    characters: [char1, char2],
    locations,
    costumes,
    props,
    screenplay,
    scenes: [
      { ...base.scenes[0], id: 'sc_e2e_1', order: 1, characterIds: ['ch_e2e_1', 'ch_e2e_2'], locationId: 'loc_e2e_1', costumeIds: ['cost_e2e_1', 'cost_e2e_2'], propIds: ['prop_e2e_1', 'prop_e2e_2'] },
      { ...base.scenes[0], id: 'sc_e2e_2', order: 2, title: 'Rooftop Dawn', characterIds: ['ch_e2e_1'], locationId: 'loc_e2e_1', costumeIds: [], propIds: [] },
      { ...base.scenes[0], id: 'sc_e2e_3', order: 3, title: 'Bunna Cafe', characterIds: ['ch_e2e_1'], locationId: 'loc_e2e_2', costumeIds: ['cost_e2e_1'], propIds: ['prop_e2e_1', 'prop_e2e_3'] },
    ],
    storyboardFrames: [],
    shotList: [],
    productionTasks: [],
    continuityAlerts: [],
    extraMetadata: {
      customDirectorFlag: 'preserve-me',
      apiKey: 'should-be-stripped-on-export',
    },
  };

  for (let i = 0; i < screenplay.length; i++) {
    const draft = extractBreakdownDraftFromScreenplay(screenplay[i], project);
    project.scenes[i] = applyBreakdownDraftToScene(project.scenes[i], draft);
  }
  assert.equal(project.scenes[0].interiorExterior, 'EXT');
  assert.equal(project.scenes[0].sourceScreenplayId, 'sp_e2e_1');

  // 7. Storyboard frames + reorder + convert to shot list
  const frameA: StoryboardFrameSpec = {
    id: 'sb_1',
    sceneId: 'sc_e2e_1',
    frameNumber: 1,
    shotNumber: '1A',
    visualDescription: 'Wide rooftop silhouette at night',
    cameraAngle: 'Low Angle',
    shotSize: 'Wide Shot',
    cameraMovement: 'Dolly',
    lighting: 'Cyan neon backlight',
    action: 'Selam approaches mic stand',
    durationSec: 4,
    generationPrompt: 'Wide cinematic shot on Addis rooftop',
    storyboardMode: 'text_only',
    generationStatus: 'planned',
    approved: true,
  };
  const frameB: StoryboardFrameSpec = {
    ...frameA,
    id: 'sb_2',
    frameNumber: 2,
    shotNumber: '1B',
    shotSize: 'Close-Up',
    visualDescription: 'Close-up on Selam singing Amharic verse',
  };
  project.storyboardFrames = reorderStoryboardFramesForScene([frameA, frameB], 'sc_e2e_1', 'sb_2', 'up');
  assert.equal(project.storyboardFrames[0].id, 'sb_2');
  assert.equal(project.storyboardFrames[0].frameNumber, 1);

  const shot1 = buildShotFromStoryboardFrame(project.storyboardFrames[0]);
  const shot2 = buildShotFromStoryboardFrame(project.storyboardFrames[1]);
  project.shotList = [shot1, shot2];

  // 8. Production schedule tasks across Pre/Prod/Post
  const tasks: ProductionTask[] = [
    {
      id: 'task_1',
      phase: 'pre_production',
      title: 'Lock Wardrobe & Location Permits',
      description: 'Approve emerald coat and rooftop permit.',
      responsiblePerson: 'Producer',
      startDate: '2026-11-27',
      endDate: '2026-11-29',
      priority: 'high',
      status: 'done',
      dependencyIds: [],
      sceneId: 'sc_e2e_1',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task_2',
      phase: 'production',
      title: 'Generate & Review Shot 1B Close-Up',
      description: 'Execute generation workflow after pre-prod lock.',
      responsiblePerson: 'AI Director',
      startDate: '2026-11-30',
      endDate: '2026-12-02',
      priority: 'urgent',
      status: 'in_progress',
      dependencyIds: ['task_1'],
      sceneId: 'sc_e2e_1',
      shotId: shot1.id,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task_3',
      phase: 'post_production',
      title: 'Subtitles & Master Render',
      description: 'Burn Amharic & Tigrigna captions and export MP4.',
      responsiblePerson: 'Editor',
      startDate: '2026-12-03',
      endDate: '2026-12-05',
      priority: 'medium',
      status: 'todo',
      dependencyIds: ['task_2'],
      updatedAt: new Date().toISOString(),
    },
  ];
  project.productionTasks = tasks;

  // 9. Continuity scan finds real cross-scene discrepancies (e.g., Selam missing costume in sc_e2e_2, rooftop NIGHT -> DAY transition, prop state difference)
  const alerts = analyzeProjectContinuity(project);
  assert.ok(alerts.some((a) => a.category === 'location' && a.classification === 'warning'));
  assert.ok(alerts.some((a) => a.category === 'costume'));
  assert.ok(alerts.some((a) => a.category === 'props' && a.classification === 'informational'));

  // Marking a continuity alert as intentional preserves explanation on subsequent scans
  const locAlert = alerts.find((a) => a.category === 'location')!;
  project.continuityAlerts = [
    {
      ...locAlert,
      intentionalDifference: true,
      explanation: 'Time-lapse sunrise transition intended in chorus.',
      resolved: true,
    },
  ];
  const rescanned = analyzeProjectContinuity(project);
  const preservedLocAlert = rescanned.find((a) => a.id === locAlert.id);
  assert.equal(preservedLocAlert?.intentionalDifference, true);
  assert.equal(preservedLocAlert?.explanation, 'Time-lapse sunrise transition intended in chorus.');

  // 10. All exports & pre-production document generators produce non-empty Unicode-safe outputs
  assert.ok(renderBreakdownMarkdown(project).includes('Piassa Neon Rooftop'));
  assert.ok(renderBreakdownMarkdown(project).includes('sp_e2e_1'));
  assert.ok(renderCharacterBibleMarkdown(project).includes('Selam'));
  assert.ok(renderCostumeBibleMarkdown(project).includes('Emerald Silk Coat'));
  assert.ok(renderLocationBibleMarkdown(project).includes('Piassa Neon Rooftop'));
  assert.ok(renderPropsListMarkdown(project).includes('Mounted on rain-flecked stand'));
  assert.ok(renderStoryboardMarkdown(project).includes('Shot 1B'));
  assert.ok(renderShotListMarkdown(project).includes('Close-Up'));
  assert.ok(renderProductionScheduleMarkdown(project).includes('Lock Wardrobe & Location Permits'));
  assert.ok(renderCompletePreProductionPackageMarkdown(project).includes('Production Schedule'));

  assert.ok(exportShotListAsCsv(project).includes('1B'));
  assert.ok(exportShotListAsJson(project).includes('Close-Up'));
  assert.ok(exportShotListAsMarkdown(project).includes('Shot List'));
  assert.ok(exportShotListAsPrintableHtml(project).includes('<table'));
  assert.ok(exportStoryboardContactSheetHtml(project).includes('Frame 1'));

  // 11. Safe deletion clears dangling location link cleanly
  const afterDeleteLoc = removeLocationSafely(project, 'loc_e2e_2');
  assert.equal(afterDeleteLoc.scenes.find((s) => s.id === 'sc_e2e_3')?.locationId, undefined);

  // 12. ZIP roundtrip preserves Phase C structures, Unicode, and strips secret-like fields
  const blob = await exportProjectToZipBlob(project);
  const buffer = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  for (const fileName of [
    'costumes.json',
    'locations.json',
    'props.json',
    'storyboard.json',
    'shot_list.json',
    'production_schedule.json',
  ]) {
    assert.ok(zip.file(fileName), `Missing ${fileName} in exported archive`);
  }

  const imported = await importProjectFromZipBuffer(buffer);
  assert.equal(imported.valid, true);
  assert.ok(imported.project);
  assert.equal(imported.project.name, 'Miniature Pre-Prod Test (አዲስ)');
  assert.equal(imported.project.costumes?.length, 2);
  assert.equal(imported.project.locations?.length, 2);
  assert.equal(imported.project.props?.length, 3);
  assert.equal(imported.project.storyboardFrames?.length, 2);
  assert.equal(imported.project.shotList?.length, 2);
  assert.equal(imported.project.productionTasks?.length, 3);
  assert.equal(imported.project.extraMetadata?.customDirectorFlag, 'preserve-me');
  assert.equal((imported.project.extraMetadata as Record<string, unknown>)?.apiKey, undefined);
});
