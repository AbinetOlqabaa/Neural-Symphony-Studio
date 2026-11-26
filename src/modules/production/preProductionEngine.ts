import type {
  CharacterEntry,
  CharacterVersionEntry,
  InteriorExterior,
  ProductionTask,
  Project,
  ScenePlan,
  ScreenplaySceneSection,
  ShotSpec,
  StoryboardFrameSpec,
} from '../../types/studio';
import { escapeHtml } from './documentSystem';

export const STANDARD_SHOT_SIZES = [
  'Extreme Wide Shot',
  'Wide Shot',
  'Full Shot',
  'Medium Wide Shot',
  'Medium Shot',
  'Medium Close-Up',
  'Close-Up',
  'Extreme Close-Up',
  'Insert Shot',
] as const;

export const STANDARD_CAMERA_ANGLES = [
  'Eye Level',
  'Low Angle',
  'High Angle',
  'Overhead / Top-Down',
  'Dutch Angle',
  'Over-the-Shoulder',
  'POV',
] as const;

export const STANDARD_CAMERA_MOVEMENTS = [
  'Static',
  'Pan',
  'Tilt',
  'Dolly',
  'Tracking',
  'Handheld',
  'Steadicam',
  'Crane',
  'Drone',
] as const;

export function normalizeCharacterEntry(char: CharacterEntry): CharacterEntry {
  return {
    ...char,
    alternativeNames: char.alternativeNames ?? '',
    ageRange: char.ageRange ?? char.approximateAgeCategory ?? '',
    gender: char.gender ?? '',
    characterCategory: char.characterCategory ?? 'supporting',
    narrativeRole: char.narrativeRole ?? char.label ?? '',
    description: char.description ?? char.distinguishingCharacteristics ?? '',
    development: {
      personality: char.development?.personality ?? '',
      background: char.development?.background ?? '',
      motivation: char.development?.motivation ?? '',
      goals: char.development?.goals ?? '',
      fears: char.development?.fears ?? '',
      strengths: char.development?.strengths ?? '',
      weaknesses: char.development?.weaknesses ?? '',
      relationships: char.development?.relationships ?? '',
      characterArc: char.development?.characterArc ?? '',
      importantEvents: char.development?.importantEvents ?? '',
    },
    visualIdentity: {
      facialStructure: char.visualIdentity?.facialStructure ?? char.facialDescription ?? '',
      skinTone: char.visualIdentity?.skinTone ?? '',
      eyes: char.visualIdentity?.eyes ?? '',
      bodyProportions: char.visualIdentity?.bodyProportions ?? '',
      generalAppearance: char.visualIdentity?.generalAppearance ?? char.distinguishingCharacteristics ?? '',
      voiceDescription: char.visualIdentity?.voiceDescription ?? '',
      defaultClothingStyle: char.visualIdentity?.defaultClothingStyle ?? char.clothing ?? '',
    },
    references: {
      approvedPortraitAssetId: char.references?.approvedPortraitAssetId ?? char.primaryReferenceAssetId,
      frontAssetIds: char.references?.frontAssetIds ?? [...char.referenceAssetIds],
      sideProfileAssetIds: char.references?.sideProfileAssetIds ?? [],
      fullBodyAssetIds: char.references?.fullBodyAssetIds ?? [],
      expressionAssetIds: char.references?.expressionAssetIds ?? [],
      characterPrompt: char.references?.characterPrompt ?? char.identityPreservationInstructions ?? '',
    },
    approved: char.approved ?? char.reviewedByHuman,
    version: char.version ?? 1,
    versionHistory: char.versionHistory ?? [],
  };
}

export function snapshotCharacterVersion(char: CharacterEntry, summary: string): CharacterEntry {
  const normalized = normalizeCharacterEntry(char);
  const nextVersion = (normalized.version || 1) + 1;
  const now = new Date().toISOString();
  const entry: CharacterVersionEntry = {
    version: nextVersion,
    createdAt: now,
    summary: summary.trim() || `Character Bible snapshot v${nextVersion}`,
    snapshot: {
      name: normalized.name,
      label: normalized.label,
      description: normalized.description || normalized.distinguishingCharacteristics,
      facialDescription: normalized.facialDescription,
      hairstyle: normalized.hairstyle,
      clothing: normalized.clothing,
      identityPreservationInstructions: normalized.identityPreservationInstructions,
    },
  };
  return {
    ...normalized,
    version: nextVersion,
    updatedAt: now,
    versionHistory: [...(normalized.versionHistory || []), entry],
  };
}

export function revertCharacterToVersion(char: CharacterEntry, version: number): CharacterEntry {
  const normalized = normalizeCharacterEntry(char);
  const target = (normalized.versionHistory || []).find((v) => v.version === version);
  if (!target) return normalized;
  return {
    ...normalized,
    name: target.snapshot.name,
    label: target.snapshot.label,
    description: target.snapshot.description,
    facialDescription: target.snapshot.facialDescription,
    hairstyle: target.snapshot.hairstyle,
    clothing: target.snapshot.clothing,
    identityPreservationInstructions: target.snapshot.identityPreservationInstructions,
    approved: false,
    updatedAt: new Date().toISOString(),
  };
}

export function reorderStoryboardFramesForScene(
  frames: StoryboardFrameSpec[],
  sceneId: string,
  frameId: string,
  direction: 'up' | 'down'
): StoryboardFrameSpec[] {
  const sceneFrames = frames
    .filter((f) => f.sceneId === sceneId)
    .slice()
    .sort((a, b) => (a.frameNumber ?? 0) - (b.frameNumber ?? 0));
  const otherFrames = frames.filter((f) => f.sceneId !== sceneId);

  const idx = sceneFrames.findIndex((f) => f.id === frameId);
  if (idx === -1) return frames;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sceneFrames.length) return frames;

  const copy = [...sceneFrames];
  const temp = copy[idx];
  copy[idx] = copy[swapIdx];
  copy[swapIdx] = temp;

  const renumbered = copy.map((f, i) => ({
    ...f,
    frameNumber: i + 1,
    shotNumber: f.shotNumber || `${i + 1}A`,
  }));

  return [...otherFrames, ...renumbered];
}

export function buildShotFromStoryboardFrame(frame: StoryboardFrameSpec): ShotSpec {
  return {
    id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    sceneId: frame.sceneId,
    storyboardFrameId: frame.id,
    shotNumber: frame.shotNumber || `S${frame.frameNumber || 1}`,
    description: frame.visualDescription,
    shotSize: frame.shotSize || 'Medium Shot',
    cameraAngle: frame.cameraAngle || 'Eye Level',
    cameraMovement: frame.cameraMovement || 'Static',
    lensGuidance: '35mm spherical prime',
    focalLengthMm: '35mm',
    cameraPosition: frame.environment || 'Standard eye-line placement',
    cameraHeight: 'Eye level',
    framing: frame.shotSize || 'Medium Shot',
    composition: frame.composition || frame.visualDescription,
    subject: frame.characterPositioning || 'Primary scene subject',
    characterPositioning: frame.characterPositioning || '',
    characterMovement: frame.action || '',
    background: frame.environment || '',
    lightingSetup: frame.lighting || '',
    colorPalette: '',
    mood: frame.mood || '',
    focus: 'Subject eyes / primary prop',
    depthOfField: 'Shallow f/2.0',
    priority: 'must_have',
    equipment: 'Camera body, tripod / gimbal',
    personnel: 'Director, DP, 1st AC',
    propIds: frame.propIds ? [...frame.propIds] : [],
    costumeIds: frame.costumeIds ? [...frame.costumeIds] : [],
    specialEffects: '',
    audioRequirements: 'Sync playback / production sound',
    notes: frame.action || '',
    durationSec: frame.durationSec || 4,
    approved: false,
    updatedAt: new Date().toISOString(),
  };
}

export interface BreakdownDraftSuggestion {
  screenplayId: string;
  targetSceneId?: string;
  slugline: string;
  interiorExterior: InteriorExterior;
  timeOfDay: string;
  locationLabel: string;
  matchedLocationId?: string;
  matchedCharacterIds: string[];
  matchedPropIds: string[];
  actionsSummary: string;
  dialogueSummary: string;
  importantObjects: string;
  environmentalConditions: string;
  emotionalTone: string;
  sourceScreenplayVersion: number;
  sourceScreenplayPassage: string;
}

export function parseSluglineMetadata(slugline: string): {
  interiorExterior: InteriorExterior;
  locationLabel: string;
  timeOfDay: string;
} {
  const upper = slugline.trim();
  let interiorExterior: InteriorExterior = 'EXT';
  if (/^INT\.?\s*\/\s*EXT\.?/i.test(upper) || /^I\/E/i.test(upper)) {
    interiorExterior = 'INT/EXT';
  } else if (/^INT\.?/i.test(upper)) {
    interiorExterior = 'INT';
  }

  const stripped = upper.replace(/^(INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\/E|INT\.?|EXT\.?)\s*/i, '');
  const parts = stripped.split(/\s+-\s+|\s+—\s+/);
  const locationLabel = (parts[0] || stripped || 'Unspecified Location').trim();
  const timeOfDay = (parts[1] || 'DAY').trim();
  return { interiorExterior, locationLabel, timeOfDay };
}

export function extractBreakdownDraftFromScreenplay(
  section: ScreenplaySceneSection,
  project: Project
): BreakdownDraftSuggestion {
  const { interiorExterior, locationLabel, timeOfDay } = parseSluglineMetadata(section.slugline);
  const fullText = `${section.slugline} ${section.actionDescription} ${section.narration} ${section.dialogueBlocks
    .map((d) => `${d.speakerName} ${d.text}`)
    .join(' ')}`.toLowerCase();

  const matchedLocation = (project.locations || []).find(
    (loc) =>
      locationLabel.toLowerCase().includes(loc.name.toLowerCase()) ||
      loc.name.toLowerCase().includes(locationLabel.toLowerCase())
  );

  const matchedCharacterIds = project.characters
    .filter(
      (c) =>
        fullText.includes(c.name.toLowerCase()) ||
        section.dialogueBlocks.some(
          (d) => d.characterId === c.id || d.speakerName.toLowerCase() === c.name.toLowerCase()
        )
    )
    .map((c) => c.id);

  const matchedPropIds = (project.props || [])
    .filter((p) => fullText.includes(p.name.toLowerCase()))
    .map((p) => p.id);

  const dialogueSummary =
    section.dialogueBlocks.length > 0
      ? section.dialogueBlocks.map((d) => `${d.speakerName} (${d.language}): ${d.text}`).join(' / ')
      : section.narration || 'No spoken dialogue in section.';

  return {
    screenplayId: section.id,
    targetSceneId: section.linkedSceneId,
    slugline: section.slugline,
    interiorExterior,
    timeOfDay,
    locationLabel,
    matchedLocationId: matchedLocation?.id,
    matchedCharacterIds,
    matchedPropIds,
    actionsSummary: section.actionDescription || '',
    dialogueSummary,
    importantObjects:
      matchedPropIds.length > 0
        ? (project.props || [])
            .filter((p) => matchedPropIds.includes(p.id))
            .map((p) => p.name)
            .join(', ')
        : '',
    environmentalConditions: /rain|wet|drizzle/i.test(fullText)
      ? 'Rain / wet surfaces'
      : /mist|fog/i.test(fullText)
      ? 'Evening mist'
      : 'Clear ambient conditions',
    emotionalTone: /quiet|solitude|contemplative/i.test(fullText)
      ? 'Contemplative & intimate'
      : /chorus|swell|skyline/i.test(fullText)
      ? 'Expansive & uplifting'
      : 'Focused narrative tension',
    sourceScreenplayVersion: section.revision,
    sourceScreenplayPassage: section.actionDescription || section.narration || section.slugline,
  };
}

export function applyBreakdownDraftToScene(
  scene: ScenePlan,
  draft: BreakdownDraftSuggestion
): ScenePlan {
  return {
    ...scene,
    interiorExterior: draft.interiorExterior,
    timeOfDay: draft.timeOfDay,
    locationId: draft.matchedLocationId ?? scene.locationId,
    characterIds: Array.from(new Set([...scene.characterIds, ...draft.matchedCharacterIds])),
    propIds: Array.from(new Set([...(scene.propIds || []), ...draft.matchedPropIds])),
    actionsSummary: draft.actionsSummary || scene.actionsSummary,
    dialogueSummary: draft.dialogueSummary || scene.dialogueSummary,
    importantObjects: draft.importantObjects || scene.importantObjects,
    environmentalConditions: draft.environmentalConditions || scene.environmentalConditions,
    emotionalTone: draft.emotionalTone || scene.emotionalTone,
    environmentDescription: scene.environmentDescription || draft.locationLabel,
    sourceScreenplayId: draft.screenplayId,
    sourceScreenplayVersion: draft.sourceScreenplayVersion,
    sourceScreenplayPassage: draft.sourceScreenplayPassage,
  };
}

// Safe deletion helpers maintaining referential integrity across all entities
export function removeCostumeSafely(project: Project, costumeId: string): Project {
  return {
    ...project,
    costumes: (project.costumes || []).filter((c) => c.id !== costumeId),
    scenes: project.scenes.map((s) => ({
      ...s,
      costumeIds: (s.costumeIds || []).filter((id) => id !== costumeId),
    })),
    storyboardFrames: (project.storyboardFrames || []).map((f) => ({
      ...f,
      costumeIds: (f.costumeIds || []).filter((id) => id !== costumeId),
    })),
    shotList: (project.shotList || []).map((sh) => ({
      ...sh,
      costumeIds: (sh.costumeIds || []).filter((id) => id !== costumeId),
    })),
  };
}

export function removeLocationSafely(project: Project, locationId: string): Project {
  return {
    ...project,
    locations: (project.locations || []).filter((l) => l.id !== locationId),
    scenes: project.scenes.map((s) => (s.locationId === locationId ? { ...s, locationId: undefined } : s)),
    props: (project.props || []).map((p) => (p.locationId === locationId ? { ...p, locationId: undefined } : p)),
    storyboardFrames: (project.storyboardFrames || []).map((f) =>
      f.locationId === locationId ? { ...f, locationId: undefined } : f
    ),
  };
}

export function removePropSafely(project: Project, propId: string): Project {
  return {
    ...project,
    props: (project.props || []).filter((p) => p.id !== propId),
    scenes: project.scenes.map((s) => ({
      ...s,
      propIds: (s.propIds || []).filter((id) => id !== propId),
    })),
    storyboardFrames: (project.storyboardFrames || []).map((f) => ({
      ...f,
      propIds: (f.propIds || []).filter((id) => id !== propId),
    })),
    shotList: (project.shotList || []).map((sh) => ({
      ...sh,
      propIds: (sh.propIds || []).filter((id) => id !== propId),
    })),
  };
}

export function removeStoryboardFrameSafely(project: Project, frameId: string): Project {
  return {
    ...project,
    storyboardFrames: (project.storyboardFrames || []).filter((f) => f.id !== frameId),
    shotList: (project.shotList || []).map((sh) =>
      sh.storyboardFrameId === frameId ? { ...sh, storyboardFrameId: undefined } : sh
    ),
  };
}

export function removeShotSafely(project: Project, shotId: string): Project {
  return {
    ...project,
    shotList: (project.shotList || []).filter((sh) => sh.id !== shotId),
    storyboardFrames: (project.storyboardFrames || []).map((f) =>
      f.shotId === shotId ? { ...f, shotId: undefined } : f
    ),
    productionTasks: (project.productionTasks || []).map((t) =>
      t.shotId === shotId ? { ...t, shotId: undefined } : t
    ),
  };
}

export function removeProductionTaskSafely(project: Project, taskId: string): Project {
  return {
    ...project,
    productionTasks: (project.productionTasks || [])
      .filter((t) => t.id !== taskId)
      .map((t) => ({
        ...t,
        dependencyIds: t.dependencyIds.filter((dep) => dep !== taskId),
      })),
  };
}

function csvCell(value: unknown): string {
  const str = String(value ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

export function exportShotListAsCsv(project: Project): string {
  const headers = [
    'Shot ID',
    'Shot Number',
    'Scene',
    'Storyboard Frame',
    'Shot Size',
    'Camera Angle',
    'Movement',
    'Focal Length / Lens',
    'Duration (s)',
    'Priority',
    'Subject & Framing',
    'Lighting & Mood',
    'Equipment',
    'Personnel',
    'Audio',
    'Approved',
  ];

  const rows = (project.shotList || []).map((shot) => {
    const sceneTitle = project.scenes.find((s) => s.id === shot.sceneId)?.title || shot.sceneId;
    return [
      shot.id,
      shot.shotNumber,
      sceneTitle,
      shot.storyboardFrameId || '',
      shot.shotSize,
      shot.cameraAngle,
      shot.cameraMovement,
      shot.focalLengthMm ? `${shot.focalLengthMm} (${shot.lensGuidance})` : shot.lensGuidance,
      shot.durationSec,
      shot.priority || 'important',
      shot.description || shot.subject || '',
      [shot.lightingSetup, shot.mood].filter(Boolean).join(' · '),
      shot.equipment || '',
      shot.personnel || '',
      shot.audioRequirements || '',
      shot.approved ? 'Yes' : 'No',
    ]
      .map(csvCell)
      .join(',');
  });

  return `\uFEFF${[headers.map(csvCell).join(','), ...rows].join('\n')}\n`;
}

export function exportShotListAsJson(project: Project): string {
  return JSON.stringify(
    {
      projectId: project.id,
      projectName: project.name,
      exportedAt: new Date().toISOString(),
      shots: project.shotList || [],
    },
    null,
    2
  );
}

export function exportShotListAsMarkdown(project: Project): string {
  const shots = project.shotList || [];
  const lines = [`# Shot List — ${project.name}`, ''];
  if (shots.length === 0) {
    lines.push('_No shots planned yet._');
    return lines.join('\n');
  }
  lines.push('| Shot # | Scene | Size | Angle | Movement | Lens | Duration | Priority | Status |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const sh of shots) {
    const sceneTitle = project.scenes.find((s) => s.id === sh.sceneId)?.title || sh.sceneId;
    lines.push(
      `| ${sh.shotNumber} | ${sceneTitle} | ${sh.shotSize} | ${sh.cameraAngle} | ${sh.cameraMovement} | ${
        sh.focalLengthMm || sh.lensGuidance
      } | ${sh.durationSec}s | ${sh.priority || 'important'} | ${sh.approved ? 'Approved' : 'Draft'} |`
    );
  }
  lines.push('');
  for (const sh of shots) {
    lines.push(`## Shot ${sh.shotNumber} (${sh.shotSize})`);
    if (sh.description) lines.push(`- **Description:** ${sh.description}`);
    if (sh.lightingSetup) lines.push(`- **Lighting:** ${sh.lightingSetup}`);
    if (sh.equipment) lines.push(`- **Equipment:** ${sh.equipment}`);
    if (sh.personnel) lines.push(`- **Personnel:** ${sh.personnel}`);
    if (sh.audioRequirements) lines.push(`- **Audio:** ${sh.audioRequirements}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function exportShotListAsPrintableHtml(project: Project): string {
  const shots = project.shotList || [];
  const rowsHtml = shots
    .map((sh) => {
      const sceneTitle = project.scenes.find((s) => s.id === sh.sceneId)?.title || sh.sceneId;
      return `<tr>
        <td><strong>${escapeHtml(sh.shotNumber)}</strong></td>
        <td>${escapeHtml(sceneTitle)}</td>
        <td>${escapeHtml(sh.shotSize)}</td>
        <td>${escapeHtml(sh.cameraAngle)}</td>
        <td>${escapeHtml(sh.cameraMovement)}</td>
        <td>${escapeHtml(sh.focalLengthMm || sh.lensGuidance)}</td>
        <td>${sh.durationSec}s</td>
        <td>${escapeHtml(sh.description || sh.subject || '')}</td>
        <td>${escapeHtml(sh.lightingSetup || '')}</td>
        <td>${sh.approved ? 'Approved' : 'Draft'}</td>
      </tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Shot List — ${escapeHtml(project.name)}</title>
  <style>
    body { font-family: "Noto Sans Ethiopic", system-ui, sans-serif; margin: 32px; color: #0f172a; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #475569; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>Shot List & Cinematography Plan — ${escapeHtml(project.name)}</h1>
  <div class="meta">Total Shots: ${shots.length} &middot; Exported: ${escapeHtml(new Date().toISOString())}</div>
  <table>
    <thead>
      <tr><th>Shot #</th><th>Scene</th><th>Size</th><th>Angle</th><th>Movement</th><th>Lens</th><th>Dur.</th><th>Action / Subject</th><th>Lighting</th><th>Status</th></tr>
    </thead>
    <tbody>${rowsHtml || '<tr><td colspan="10">No shots planned yet.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

export function exportStoryboardContactSheetHtml(project: Project): string {
  const frames = project.storyboardFrames || [];
  const cards = frames
    .map((frame) => {
      const scene = project.scenes.find((s) => s.id === frame.sceneId);
      const asset = project.mediaAssets.find(
        (a) => a.id === (frame.referenceAssetId || frame.referenceAssetIds?.[0])
      );
      const imgUrl =
        frame.generationStatus === 'generated' && frame.generatedImageUrl
          ? frame.generatedImageUrl
          : asset?.thumbnailUrl || asset?.dataUrl;

      return `<div class="card">
        <div class="thumb">${
          imgUrl
            ? `<img src="${escapeHtml(imgUrl)}" alt="Frame ${escapeHtml(frame.shotNumber)}" />`
            : `<div class="placeholder">Text-Only Storyboard Card (${escapeHtml(
                frame.generationStatus || 'planned'
              )})</div>`
        }</div>
        <div class="body">
          <div class="head"><strong>Frame ${frame.frameNumber || ''} · ${escapeHtml(
        frame.shotNumber
      )}</strong><span>${frame.durationSec}s</span></div>
          <div class="scene">${escapeHtml(scene?.title || frame.sceneId)}</div>
          <p>${escapeHtml(frame.visualDescription)}</p>
          <div class="specs">${escapeHtml(frame.shotSize)} · ${escapeHtml(frame.cameraAngle)} · ${escapeHtml(
        frame.cameraMovement
      )} · ${escapeHtml(frame.lighting)}</div>
        </div>
      </div>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Storyboard Contact Sheet — ${escapeHtml(project.name)}</title>
  <style>
    body { font-family: "Noto Sans Ethiopic", system-ui, sans-serif; margin: 32px; color: #0f172a; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #475569; font-size: 12px; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .card { border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; break-inside: avoid; }
    .thumb { aspect-ratio: 16/9; background: #0f172a; display: flex; align-items: center; justify-content: center; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .placeholder { color: #94a3b8; font-size: 11px; padding: 12px; text-align: center; }
    .body { padding: 10px; font-size: 12px; }
    .head { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .scene { color: #475569; font-size: 11px; margin-bottom: 6px; }
    .specs { color: #64748b; font-size: 11px; margin-top: 6px; }
    @media print { body { margin: 10mm; } .grid { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <h1>Storyboard Contact Sheet — ${escapeHtml(project.name)}</h1>
  <div class="meta">Frames: ${frames.length} &middot; Scenes: ${project.scenes.length}</div>
  <div class="grid">${cards || '<p>No storyboard frames created yet.</p>'}</div>
</body>
</html>`;
}

export function sortProductionTasksChronologically(tasks: ProductionTask[]): ProductionTask[] {
  return tasks
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title));
}
