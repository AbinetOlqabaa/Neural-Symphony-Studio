import JSZip from 'jszip';
import type { Project } from '../../types/studio';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  migrateProjectSchema,
  sanitizeProjectForPortableExport,
} from './projectMigration';

export const PROJECT_ARCHIVE_SCHEMA_VERSION = CURRENT_PROJECT_SCHEMA_VERSION;

export interface PortableManifest {
  schemaVersion: string;
  exportedAt: string;
  application: 'Neural Symphony Studio';
  projectId: string;
  projectName: string;
  assetCount: number;
  sceneCount: number;
  characterCount: number;
  clipCount: number;
  documentCount?: number;
  extraMetadata?: Record<string, unknown>;
}

export function buildPortableManifest(project: Project): PortableManifest {
  return {
    schemaVersion: PROJECT_ARCHIVE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    application: 'Neural Symphony Studio',
    projectId: project.id,
    projectName: project.name,
    assetCount: project.mediaAssets.length,
    sceneCount: project.scenes.length,
    characterCount: project.characters.length,
    clipCount: project.clips.length,
    documentCount: project.productionDocuments?.length || 0,
    extraMetadata: project.extraMetadata,
  };
}

export function validateProjectObject(raw: unknown): {
  valid: boolean;
  project?: Project;
  errors: string[];
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Project payload must be a JSON object.'] };
  }
  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof obj.id !== 'string' || !obj.id.trim()) errors.push('Missing string project "id".');
  if (typeof obj.name !== 'string' || !obj.name.trim()) errors.push('Missing string project "name".');
  if (!Array.isArray(obj.mediaAssets)) errors.push('Missing "mediaAssets" array.');
  if (!Array.isArray(obj.characters)) errors.push('Missing "characters" array.');
  if (!Array.isArray(obj.scenes)) errors.push('Missing "scenes" array.');
  if (!obj.timeline || typeof obj.timeline !== 'object') errors.push('Missing "timeline" object.');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, project: migrateProjectSchema(obj as unknown as Project), errors: [] };
}

function dataUrlToBase64Parts(dataUrl: string): { base64: string; ext: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext = mime.includes('png')
    ? 'png'
    : mime.includes('webp')
    ? 'webp'
    : mime.includes('mp3') || mime.includes('mpeg')
    ? 'mp3'
    : mime.includes('wav')
    ? 'wav'
    : 'jpg';
  return { base64: match[2], ext };
}

export async function exportProjectToZipBlob(project: Project): Promise<Blob> {
  const safeProject = sanitizeProjectForPortableExport(project);
  const zip = new JSZip();
  const manifest = buildPortableManifest(safeProject);

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('project.json', JSON.stringify(safeProject, null, 2));
  zip.file('character_bible.json', JSON.stringify(safeProject.characters, null, 2));
  zip.file('scene_plan.json', JSON.stringify(safeProject.scenes, null, 2));
  zip.file('prompt_history.json', JSON.stringify(safeProject.promptHistory, null, 2));
  zip.file('timeline.json', JSON.stringify(safeProject.timeline, null, 2));

  if (safeProject.creativeBrief) {
    zip.file('creative_brief.json', JSON.stringify(safeProject.creativeBrief, null, 2));
  }
  if (safeProject.screenplay && safeProject.screenplay.length > 0) {
    zip.file('screenplay.json', JSON.stringify(safeProject.screenplay, null, 2));
  }
  if (safeProject.costumes && safeProject.costumes.length > 0) {
    zip.file('costumes.json', JSON.stringify(safeProject.costumes, null, 2));
  }
  if (safeProject.locations && safeProject.locations.length > 0) {
    zip.file('locations.json', JSON.stringify(safeProject.locations, null, 2));
  }
  if (safeProject.props && safeProject.props.length > 0) {
    zip.file('props.json', JSON.stringify(safeProject.props, null, 2));
  }
  if (safeProject.storyboardFrames && safeProject.storyboardFrames.length > 0) {
    zip.file('storyboard.json', JSON.stringify(safeProject.storyboardFrames, null, 2));
  }
  if (safeProject.shotList && safeProject.shotList.length > 0) {
    zip.file('shot_list.json', JSON.stringify(safeProject.shotList, null, 2));
  }
  if (safeProject.productionTasks && safeProject.productionTasks.length > 0) {
    zip.file('production_schedule.json', JSON.stringify(safeProject.productionTasks, null, 2));
  }
  if (safeProject.productionDocuments && safeProject.productionDocuments.length > 0) {
    const docsFolder = zip.folder('production_documents');
    for (const doc of safeProject.productionDocuments) {
      const safeDocName = doc.title.replace(/[^a-zA-Z0-9\u1200-\u137F._-]+/g, '_').slice(0, 80);
      docsFolder?.file(`${doc.id}_${safeDocName}.md`, doc.contentMarkdown);
    }
  }

  const mediaFolder = zip.folder('media');
  for (const asset of safeProject.mediaAssets) {
    const parts = dataUrlToBase64Parts(asset.dataUrl);
    if (parts) {
      const safeName = asset.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
      mediaFolder?.file(safeName, parts.base64, { base64: true });
    }
  }

  if (safeProject.musicAsset?.dataUrl) {
    const parts = dataUrlToBase64Parts(safeProject.musicAsset.dataUrl);
    if (parts) {
      const safeAudioName = safeProject.musicAsset.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
      mediaFolder?.file(safeAudioName, parts.base64, { base64: true });
    }
  }

  const workflowsFolder = zip.folder('workflows');
  for (const wf of safeProject.workflows) {
    workflowsFolder?.file(`${wf.id}.json`, JSON.stringify(wf.json, null, 2));
  }

  if (safeProject.lyrics.length > 0) {
    const lrcBody = safeProject.lyrics
      .map(
        (l) =>
          `[${String(Math.floor(l.startTimeSec / 60)).padStart(2, '0')}:${String(
            Math.floor(l.startTimeSec % 60)
          ).padStart(2, '0')}.00] ${l.text}`
      )
      .join('\n');
    zip.file('lyrics.lrc', lrcBody);
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function importProjectFromZipBuffer(buffer: ArrayBuffer): Promise<{
  valid: boolean;
  project?: Project;
  manifest?: PortableManifest;
  errors: string[];
}> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const projectFile = zip.file('project.json');
    if (!projectFile) {
      return { valid: false, errors: ['Archive is missing required "project.json".'] };
    }
    const projectJsonText = await projectFile.async('string');
    const parsedProject = JSON.parse(projectJsonText);
    const validation = validateProjectObject(parsedProject);
    if (!validation.valid || !validation.project) {
      return { valid: false, errors: validation.errors };
    }

    let manifest: PortableManifest | undefined;
    const manifestFile = zip.file('manifest.json');
    if (manifestFile) {
      manifest = JSON.parse(await manifestFile.async('string')) as PortableManifest;
    }

    return {
      valid: true,
      project: validation.project,
      manifest,
      errors: [],
    };
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : 'Failed to parse project ZIP archive.'],
    };
  }
}
