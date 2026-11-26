import type {
  CreativeBrief,
  LanguageConfig,
  ProductionDocument,
  Project,
  ScreenplaySceneSection,
} from '../../types/studio';
import {
  createProductionDocument,
  renderBreakdownMarkdown,
  renderCharacterBibleMarkdown,
  renderCreativeBriefMarkdown,
} from '../production/documentSystem';

import { normalizeCharacterEntry } from '../production/preProductionEngine';

export const CURRENT_PROJECT_SCHEMA_VERSION = '2.1.0';

export function buildDefaultCreativeBrief(project: Project): CreativeBrief {
  return {
    concept: project.description || `${project.name} production concept`,
    briefSummary: project.description || '',
    logline: '',
    synopsis: project.description || '',
    treatment: '',
    theme: '',
    targetAudience: '',
    genre: project.isDemoProject ? 'Music Video / Urban Soul' : 'Multimedia Production',
    category: 'music_video',
    intendedDurationSec: Math.max(
      15,
      project.scenes.reduce((sum, s) => sum + (s.durationSeconds || 4), 0)
    ),
    primaryLanguage: 'en',
    targetLanguages: ['en', 'am', 'om', 'ti'],
    visualDirection: 'Preserve consistent character identity, lighting continuity, and 35mm cinematic texture.',
    objectives: 'Translate written creative development into verified scene prompts and rendered video clips.',
    updatedAt: project.updatedAt || new Date().toISOString(),
    approved: false,
  };
}

export function buildDefaultScreenplayFromScenes(project: Project): ScreenplaySceneSection[] {
  const ordered = (project.scenes || []).slice().sort((a, b) => a.order - b.order);
  return ordered.map((scene, idx) => {
    const timestamp = project.updatedAt || new Date().toISOString();
    const firstLyric = project.lyrics.find((l) => l.sceneId === scene.id);
    const dialogueBlocks = firstLyric
      ? [
          {
            id: `dlg_${scene.id}_1`,
            characterId: scene.characterIds[0],
            speakerName:
              project.characters.find((c) => c.id === scene.characterIds[0])?.name || 'Performer',
            language: firstLyric.language.toLowerCase().includes('amharic')
              ? ('am' as const)
              : firstLyric.language.toLowerCase().includes('orom')
              ? ('om' as const)
              : firstLyric.language.toLowerCase().includes('tigr')
              ? ('ti' as const)
              : ('en' as const),
            text: firstLyric.text,
            deliveryNotes: `Synced lyric beat (${firstLyric.section})`,
          },
        ]
      : [];

    return {
      id: `scr_${scene.id}`,
      order: idx + 1,
      linkedSceneId: scene.id,
      actNumber: 1,
      sequenceName: scene.narrativePurpose || `Sequence ${idx + 1}`,
      slugline: `EXT./INT. ${scene.environmentDescription.slice(0, 48).toUpperCase() || scene.title.toUpperCase()}`,
      sceneType: 'music_video',
      actionDescription: scene.description,
      narration: '',
      dialogueBlocks,
      estimatedDurationSec: scene.durationSeconds || 4,
      revision: 1,
      approved: scene.approvedForGeneration,
      updatedAt: timestamp,
      versionHistory: [
        {
          version: 1,
          createdAt: timestamp,
          summary: 'Migrated from scene plan',
          snapshotText: scene.description,
        },
      ],
    };
  });
}

export function buildInitialProductionDocuments(project: Project): ProductionDocument[] {
  const briefDoc = createProductionDocument({
    id: `doc_brief_${project.id}`,
    type: 'creative_brief',
    title: `${project.name} — Creative Brief`,
    language: project.creativeBrief?.primaryLanguage || 'en',
    contentMarkdown: renderCreativeBriefMarkdown(project),
    linkedSceneIds: project.scenes.map((s) => s.id),
    linkedCharacterIds: project.characters.map((c) => c.id),
    summary: 'Auto-generated from project creative brief',
  });

  const breakdownDoc = createProductionDocument({
    id: `doc_breakdown_${project.id}`,
    type: 'breakdown',
    title: `${project.name} — Scene Breakdown`,
    language: project.creativeBrief?.primaryLanguage || 'en',
    contentMarkdown: renderBreakdownMarkdown(project),
    linkedSceneIds: project.scenes.map((s) => s.id),
    linkedCharacterIds: project.characters.map((c) => c.id),
    summary: 'Auto-generated scene breakdown',
  });

  const charDoc = createProductionDocument({
    id: `doc_characters_${project.id}`,
    type: 'character_bible',
    title: `${project.name} — Character Bible`,
    language: project.creativeBrief?.primaryLanguage || 'en',
    contentMarkdown: renderCharacterBibleMarkdown(project),
    linkedCharacterIds: project.characters.map((c) => c.id),
    summary: 'Auto-generated character continuity reference',
  });

  return [briefDoc, breakdownDoc, charDoc];
}

export function migrateProjectSchema(rawProject: Project): Project {
  const defaultBrief = rawProject.creativeBrief || buildDefaultCreativeBrief(rawProject);
  const withBrief: Project = {
    ...rawProject,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    characters: (rawProject.characters || []).map(normalizeCharacterEntry),
    creativeBrief: defaultBrief,
    languageConfig: rawProject.languageConfig || {
      primaryLanguage: defaultBrief.primaryLanguage,
      targetLanguages: defaultBrief.targetLanguages,
      voiceProviderByLanguage: {},
      humanLinguisticReviewRequired: true,
    },
    costumes: rawProject.costumes || [],
    locations: rawProject.locations || [],
    props: rawProject.props || [],
    storyboardFrames: rawProject.storyboardFrames || [],
    shotList: rawProject.shotList || [],
    productionTasks: rawProject.productionTasks || [],
    continuityAlerts: rawProject.continuityAlerts || [],
  };

  if (!withBrief.screenplay) {
    withBrief.screenplay = buildDefaultScreenplayFromScenes(withBrief);
  }
  if (!withBrief.productionDocuments || withBrief.productionDocuments.length === 0) {
    withBrief.productionDocuments = buildInitialProductionDocuments(withBrief);
  }

  return withBrief;
}

const SECRET_KEY_PATTERN = /(api[-_]?key|secret|token|password|credential)/i;

function stripSecretsFromUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSecretsFromUnknown);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(k)) continue;
      out[k] = stripSecretsFromUnknown(v);
    }
    return out;
  }
  return value;
}

export function sanitizeProjectForPortableExport(project: Project): Project {
  const migrated = migrateProjectSchema(project);
  return {
    ...migrated,
    extraMetadata: migrated.extraMetadata
      ? (stripSecretsFromUnknown(migrated.extraMetadata) as Record<string, unknown>)
      : undefined,
  };
}
