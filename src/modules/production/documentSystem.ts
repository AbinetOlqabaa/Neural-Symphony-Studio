import type {
  DocumentComment,
  DocumentStatus,
  DocumentType,
  ProductionDocument,
  ProductionLanguage,
  Project,
} from '../../types/studio';

export const PRODUCTION_LANGUAGES: Array<{ code: ProductionLanguage; label: string; nativeName: string }> = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'am', label: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'om', label: 'Afaan Oromoo', nativeName: 'Afaan Oromoo' },
  { code: 'ti', label: 'Tigrigna', nativeName: 'ትግርኛ' },
];

export function formatLanguageLabel(code: ProductionLanguage): string {
  const found = PRODUCTION_LANGUAGES.find((l) => l.code === code);
  if (!found) return code;
  return found.label === found.nativeName ? found.label : `${found.label} (${found.nativeName})`;
}

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createProductionDocument(input: {
  id?: string;
  type: DocumentType;
  title: string;
  language?: ProductionLanguage;
  contentMarkdown: string;
  structuredData?: Record<string, unknown>;
  linkedSceneIds?: string[];
  linkedCharacterIds?: string[];
  status?: DocumentStatus;
  aiAssisted?: boolean;
  summary?: string;
}): ProductionDocument {
  const now = new Date().toISOString();
  const normalizedContent = input.contentMarkdown.normalize('NFC');
  return {
    id: input.id || `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    type: input.type,
    title: input.title.trim().normalize('NFC'),
    language: input.language || 'en',
    contentMarkdown: normalizedContent,
    structuredData: input.structuredData,
    version: 1,
    versionHistory: [
      {
        version: 1,
        createdAt: now,
        contentMarkdown: normalizedContent,
        summary: input.summary || 'Initial document revision',
      },
    ],
    status: input.status || 'draft',
    comments: [],
    linkedSceneIds: input.linkedSceneIds || [],
    linkedCharacterIds: input.linkedCharacterIds || [],
    updatedAt: now,
    aiAssisted: input.aiAssisted,
  };
}

export function updateProductionDocumentWithVersion(
  doc: ProductionDocument,
  patch: {
    title?: string;
    contentMarkdown?: string;
    language?: ProductionLanguage;
    linkedSceneIds?: string[];
    linkedCharacterIds?: string[];
    structuredData?: Record<string, unknown>;
    summary?: string;
  }
): ProductionDocument {
  const now = new Date().toISOString();
  const nextContent =
    patch.contentMarkdown !== undefined ? patch.contentMarkdown.normalize('NFC') : doc.contentMarkdown;
  const contentChanged = nextContent !== doc.contentMarkdown;
  const nextVersion = contentChanged ? doc.version + 1 : doc.version;

  const nextHistory = contentChanged
    ? [
        ...doc.versionHistory,
        {
          version: nextVersion,
          createdAt: now,
          contentMarkdown: nextContent,
          summary: patch.summary || `Updated v${nextVersion}`,
        },
      ]
    : doc.versionHistory;

  return {
    ...doc,
    title: patch.title !== undefined ? patch.title.trim().normalize('NFC') : doc.title,
    language: patch.language ?? doc.language,
    contentMarkdown: nextContent,
    linkedSceneIds: patch.linkedSceneIds ?? doc.linkedSceneIds,
    linkedCharacterIds: patch.linkedCharacterIds ?? doc.linkedCharacterIds,
    structuredData: patch.structuredData ?? doc.structuredData,
    version: nextVersion,
    versionHistory: nextHistory,
    status: contentChanged && doc.status === 'approved' ? 'in_review' : doc.status,
    updatedAt: now,
  };
}

export function setDocumentStatus(doc: ProductionDocument, status: DocumentStatus): ProductionDocument {
  return {
    ...doc,
    status,
    updatedAt: new Date().toISOString(),
  };
}

export function addDocumentComment(
  doc: ProductionDocument,
  author: string,
  text: string
): ProductionDocument {
  const cleanText = text.trim().normalize('NFC');
  if (!cleanText) return doc;
  const comment: DocumentComment = {
    id: `cmt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    author: author.trim() || 'Director',
    text: cleanText,
    createdAt: new Date().toISOString(),
    resolved: false,
  };
  return {
    ...doc,
    comments: [...doc.comments, comment],
    updatedAt: comment.createdAt,
  };
}

export function renderCreativeBriefMarkdown(project: Project): string {
  const brief = project.creativeBrief;
  if (!brief) {
    return `# ${project.name}\n\n## Concept\n${project.description}\n`;
  }
  return [
    `# Creative Brief — ${project.name}`,
    '',
    `- **Category:** ${brief.category.replace(/_/g, ' ')}`,
    `- **Genre:** ${brief.genre || 'Not specified'}`,
    `- **Intended Duration:** ${brief.intendedDurationSec}s`,
    `- **Primary Language:** ${formatLanguageLabel(brief.primaryLanguage)}`,
    `- **Target Languages:** ${brief.targetLanguages.map(formatLanguageLabel).join(', ') || 'English'}`,
    `- **Approval Status:** ${brief.approved ? 'Approved' : 'Draft / Pending Review'}`,
    '',
    '## Concept',
    brief.concept || project.description,
    '',
    '## Logline',
    brief.logline || '_Not drafted yet._',
    '',
    '## Synopsis',
    brief.synopsis || '_Not drafted yet._',
    '',
    '## Treatment',
    brief.treatment || '_Not drafted yet._',
    '',
    '## Theme & Target Audience',
    `**Theme:** ${brief.theme || 'Unspecified'}  `,
    `**Audience:** ${brief.targetAudience || 'Unspecified'}`,
    '',
    '## Visual Direction & Objectives',
    brief.visualDirection || '_Not specified._',
    '',
    brief.objectives ? `### Objectives\n${brief.objectives}` : '',
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

export function renderScreenplayMarkdown(project: Project): string {
  const sections = (project.screenplay || []).slice().sort((a, b) => a.order - b.order);
  if (sections.length === 0) {
    return `# Screenplay — ${project.name}\n\n_No screenplay scenes created yet._\n`;
  }
  const parts: string[] = [`# Screenplay — ${project.name}`, ''];
  for (const s of sections) {
    parts.push(`## Act ${s.actNumber} · ${s.sequenceName || 'Sequence'} — ${s.slugline}`);
    parts.push(
      `_Scene Link: ${s.linkedSceneId || 'Unlinked'} · Est. ${s.estimatedDurationSec}s · Rev v${s.revision} · ${
        s.approved ? 'Approved' : 'Pending Review'
      }_`
    );
    parts.push('');
    if (s.actionDescription) {
      parts.push(s.actionDescription);
      parts.push('');
    }
    if (s.narration) {
      parts.push(`> **NARRATION:** ${s.narration}`);
      parts.push('');
    }
    for (const d of s.dialogueBlocks) {
      parts.push(`**${d.speakerName.toUpperCase()} (${formatLanguageLabel(d.language)}):** ${d.text}`);
      if (d.deliveryNotes) {
        parts.push(`_(${d.deliveryNotes})_`);
      }
      parts.push('');
    }
  }
  return parts.join('\n');
}

export function renderBreakdownMarkdown(project: Project): string {
  const lines = [`# Production & Scene Breakdown — ${project.name}`, ''];
  const orderedScenes = project.scenes.slice().sort((a, b) => a.order - b.order);
  if (orderedScenes.length === 0) {
    lines.push('_No scenes created yet._');
    return lines.join('\n');
  }
  for (const scene of orderedScenes) {
    const chars = project.characters
      .filter((c) => scene.characterIds.includes(c.id))
      .map((c) => c.name);
    const loc = (project.locations || []).find((l) => l.id === scene.locationId);
    const costumes = (project.costumes || [])
      .filter((co) => (scene.costumeIds || []).includes(co.id) || co.sceneIds.includes(scene.id))
      .map((co) => co.name || co.garmentDescription);
    const props = (project.props || [])
      .filter((p) => (scene.propIds || []).includes(p.id) || p.sceneIds.includes(scene.id))
      .map((p) => p.name);

    lines.push(`## ${scene.title}`);
    lines.push(`- **Scene ID:** \`${scene.id}\``);
    lines.push(`- **INT/EXT & Time:** ${scene.interiorExterior || 'Not specified'} · ${scene.timeOfDay || 'Not specified'}`);
    lines.push(`- **Duration:** ${scene.durationSeconds}s`);
    lines.push(`- **Location:** ${loc ? loc.name : scene.environmentDescription || '[Not yet specified]'}`);
    lines.push(`- **Characters:** ${chars.length > 0 ? chars.join(', ') : '[None assigned]'}`);
    lines.push(`- **Costumes / Wardrobe:** ${costumes.length > 0 ? costumes.join(', ') : scene.wardrobeRequirements || '[Not yet specified]'}`);
    lines.push(`- **Props & Objects:** ${props.length > 0 ? props.join(', ') : scene.importantObjects || '[Not yet specified]'}`);
    lines.push(`- **Lighting & Environment:** ${scene.lighting || '[Not specified]'} · ${scene.environmentalConditions || '[Not specified]'}`);
    lines.push(`- **Camera Framing & Movement:** ${scene.cameraFraming} · ${scene.cameraMovement}`);
    lines.push(`- **Emotional Tone & Complexity:** ${scene.emotionalTone || '[Not specified]'} · ${scene.productionComplexity || 'medium'}`);
    lines.push(`- **Narrative Purpose:** ${scene.narrativePurpose || '[Not specified]'}`);
    if (scene.sourceScreenplayId) {
      lines.push(`- **Screenplay Traceability:** \`${scene.sourceScreenplayId}\` (rev v${scene.sourceScreenplayVersion || 1})`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function renderCharacterBibleMarkdown(project: Project): string {
  const lines = [`# Character Bible — ${project.name}`, ''];
  if (project.characters.length === 0) {
    lines.push('_No characters registered yet._');
    return lines.join('\n');
  }
  for (const c of project.characters) {
    lines.push(`## ${c.name} (${c.label || c.characterCategory || 'Role'})`);
    lines.push(`- **Character ID:** \`${c.id}\``);
    lines.push(`- **Alternative Names:** ${c.alternativeNames || '[None]'}`);
    lines.push(`- **Age / Gender:** ${c.ageRange || c.approximateAgeCategory || '[Not specified]'} · ${c.gender || '[Not specified]'}`);
    lines.push(`- **Narrative Role:** ${c.narrativeRole || c.label || '[Not specified]'}`);
    lines.push(`- **Description:** ${c.description || c.distinguishingCharacteristics || '[Not specified]'}`);
    lines.push(`- **Facial Description:** ${c.facialDescription || '[Not specified]'}`);
    lines.push(`- **Hairstyle:** ${c.hairstyle || '[Not specified]'}`);
    lines.push(`- **Default Clothing:** ${c.clothing || c.visualIdentity?.defaultClothingStyle || '[Not specified]'}`);
    lines.push(`- **Accessories:** ${c.accessories || '[None]'}`);
    if (c.development?.characterArc || c.development?.motivation) {
      lines.push(`- **Motivation & Arc:** ${c.development.motivation || '[Not specified]'} — ${c.development.characterArc || '[Not specified]'}`);
    }
    lines.push(`- **Identity Preservation Rules:** ${c.identityPreservationInstructions || '[Not specified]'}`);
    lines.push(`- **References Linked:** ${c.referenceAssetIds.length} asset(s)`);
    lines.push(`- **Human Review:** ${c.reviewedByHuman || c.approved ? 'Approved' : 'Needs Review'} (v${c.version || 1})`);
    lines.push('');
  }
  return lines.join('\n');
}

export function renderCostumeBibleMarkdown(project: Project): string {
  const costumes = project.costumes || [];
  const lines = [`# Costume & Wardrobe Bible — ${project.name}`, ''];
  if (costumes.length === 0) {
    lines.push('_No costumes defined yet._');
    return lines.join('\n');
  }
  for (const co of costumes) {
    const charName = project.characters.find((c) => c.id === co.characterId)?.name || co.characterId || '[Unassigned]';
    const sceneNames = project.scenes.filter((s) => co.sceneIds.includes(s.id)).map((s) => s.title);
    lines.push(`## ${co.name || co.garmentDescription}`);
    lines.push(`- **Character:** ${charName}`);
    lines.push(`- **Scenes:** ${sceneNames.length > 0 ? sceneNames.join(', ') : '[Not assigned]'}`);
    lines.push(`- **Timeline / Purpose:** ${co.storyTimeline || '[Not specified]'} · ${co.narrativePurpose || '[Not specified]'}`);
    lines.push(`- **Garments:** ${co.garmentDescription}${co.garmentComponents ? ` (${co.garmentComponents})` : ''}`);
    lines.push(`- **Fabric & Pattern:** ${co.fabric || '[Not specified]'} · ${co.pattern || '[Not specified]'}`);
    lines.push(`- **Colors & Footwear:** ${co.color || '[Not specified]'} · ${co.footwear || '[Not specified]'}`);
    lines.push(`- **Accessories & Weather:** ${co.accessories || '[None]'} · ${co.weatherSuitability || '[Not specified]'}`);
    lines.push(`- **Cultural Context:** ${co.culturalContext || '[Not specified]'}`);
    lines.push(`- **Condition / Continuity Notes:** ${co.conditionState || 'Clean / Standard'} — ${co.continuityNotes || '[None]'}`);
    lines.push(`- **Status:** ${co.approved ? 'Approved' : 'Draft'}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function renderLocationBibleMarkdown(project: Project): string {
  const locations = project.locations || [];
  const lines = [`# Location Bible — ${project.name}`, ''];
  if (locations.length === 0) {
    lines.push('_No locations defined yet._');
    return lines.join('\n');
  }
  for (const loc of locations) {
    const sceneNames = project.scenes.filter((s) => loc.sceneIds.includes(s.id) || s.locationId === loc.id).map((s) => s.title);
    lines.push(`## ${loc.name}`);
    lines.push(`- **Type & Setting:** ${(loc.locationType || 'real_world').replace(/_/g, ' ')} · ${loc.interiorExterior || 'EXT'} · ${loc.timeOfDay || '[Not specified]'}`);
    lines.push(`- **Geographic Context:** ${loc.geographicInfo || '[Not specified]'}`);
    lines.push(`- **Architecture & Features:** ${loc.architecturalStyle || '[Not specified]'} · ${loc.visualFeatures || '[Not specified]'}`);
    lines.push(`- **Environment & Weather:** ${loc.environmentDescription || '[Not specified]'} · ${loc.weather || '[Not specified]'}`);
    lines.push(`- **Lighting Plan:** ${loc.lighting || '[Not specified]'}`);
    lines.push(`- **Associated Scenes:** ${sceneNames.length > 0 ? sceneNames.join(', ') : '[None linked]'}`);
    lines.push(`- **Continuity Notes:** ${loc.continuityNotes || '[None]'}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function renderPropsListMarkdown(project: Project): string {
  const props = project.props || [];
  const lines = [`# Props & Set Design Inventory — ${project.name}`, ''];
  if (props.length === 0) {
    lines.push('_No props registered yet._');
    return lines.join('\n');
  }
  for (const p of props) {
    const chars = project.characters.filter((c) => p.characterIds.includes(c.id)).map((c) => c.name);
    const loc = (project.locations || []).find((l) => l.id === p.locationId)?.name;
    lines.push(`## ${p.name} (${(p.category || 'handheld').replace(/_/g, ' ')})`);
    lines.push(`- **Importance:** ${p.narrativeImportance || 'featured'}`);
    lines.push(`- **Description:** ${p.description || '[Not specified]'}`);
    lines.push(`- **Materials & Colors:** ${p.materials || '[Not specified]'} · ${p.colors || '[Not specified]'}`);
    lines.push(`- **Characters:** ${chars.length > 0 ? chars.join(', ') : '[None]'}`);
    lines.push(`- **Primary Location:** ${loc || '[Unassigned]'}`);
    if (p.sceneStates && p.sceneStates.length > 0) {
      lines.push(`- **State Progression:** ${p.sceneStates.map((st) => `${st.sceneId}: ${st.stateLabel}`).join(' -> ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function renderStoryboardMarkdown(project: Project): string {
  const frames = (project.storyboardFrames || []).slice().sort((a, b) => (a.frameNumber ?? 0) - (b.frameNumber ?? 0));
  const lines = [`# Storyboard Contact Sheet — ${project.name}`, ''];
  if (frames.length === 0) {
    lines.push('_No storyboard frames planned yet._');
    return lines.join('\n');
  }
  for (const f of frames) {
    const sceneTitle = project.scenes.find((s) => s.id === f.sceneId)?.title || f.sceneId;
    lines.push(`## Frame ${f.frameNumber || ''} · Shot ${f.shotNumber} (${sceneTitle})`);
    lines.push(`- **Mode & Asset Status:** ${f.storyboardMode || 'reference_image'} · ${f.generationStatus || 'planned'}`);
    lines.push(`- **Visual Description:** ${f.visualDescription || '[Not specified]'}`);
    lines.push(`- **Camera:** ${f.shotSize} · ${f.cameraAngle} · ${f.cameraMovement}`);
    lines.push(`- **Lighting & Mood:** ${f.lighting || '[Not specified]'} · ${f.mood || '[Not specified]'}`);
    lines.push(`- **Action:** ${f.action || '[Not specified]'} (${f.durationSec}s)`);
    lines.push('');
  }
  return lines.join('\n');
}

export function renderShotListMarkdown(project: Project): string {
  const shots = project.shotList || [];
  const lines = [`# Shot List & Cinematography Plan — ${project.name}`, ''];
  if (shots.length === 0) {
    lines.push('_No shots planned yet._');
    return lines.join('\n');
  }
  lines.push('| Shot # | Scene | Size | Angle | Movement | Lens | Dur | Priority | Status |');
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
  return lines.join('\n');
}

export function renderProductionScheduleMarkdown(project: Project): string {
  const tasks = (project.productionTasks || []).slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
  const lines = [`# Production Schedule — ${project.name}`, ''];
  if (tasks.length === 0) {
    lines.push('_No schedule tasks created yet._');
    return lines.join('\n');
  }
  lines.push('| Phase | Task | Owner | Start | End | Priority | Status |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const t of tasks) {
    lines.push(
      `| ${t.phase.replace(/_/g, ' ')} | ${t.title} | ${t.responsiblePerson || '[Unassigned]'} | ${t.startDate} | ${t.endDate} | ${t.priority} | ${t.status.replace(/_/g, ' ')} |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function renderCompletePreProductionPackageMarkdown(project: Project): string {
  return [
    `# Complete Pre-Production Package — ${project.name}`,
    `_Schema: v${project.schemaVersion || '2.1.0'} · Generated from current project records (missing items explicitly noted)._`,
    '',
    '---',
    '',
    renderCreativeBriefMarkdown(project),
    '---',
    '',
    renderScreenplayMarkdown(project),
    '---',
    '',
    renderBreakdownMarkdown(project),
    '---',
    '',
    renderCharacterBibleMarkdown(project),
    '---',
    '',
    renderCostumeBibleMarkdown(project),
    '---',
    '',
    renderLocationBibleMarkdown(project),
    '---',
    '',
    renderPropsListMarkdown(project),
    '---',
    '',
    renderStoryboardMarkdown(project),
    '---',
    '',
    renderShotListMarkdown(project),
    '---',
    '',
    renderProductionScheduleMarkdown(project),
  ].join('\n');
}

export function exportDocumentAsMarkdown(doc: ProductionDocument): string {
  const header = [
    `---`,
    `title: "${doc.title.replace(/"/g, '\\"')}"`,
    `type: ${doc.type}`,
    `language: ${doc.language}`,
    `version: ${doc.version}`,
    `status: ${doc.status}`,
    `updatedAt: ${doc.updatedAt}`,
    `linkedScenes: [${doc.linkedSceneIds.join(', ')}]`,
    `linkedCharacters: [${doc.linkedCharacterIds.join(', ')}]`,
    `---`,
    '',
  ].join('\n');
  return `${header}${doc.contentMarkdown.normalize('NFC')}\n`;
}

export function exportDocumentAsJson(doc: ProductionDocument): string {
  return JSON.stringify(doc, null, 2);
}

function markdownToSimpleHtml(markdown: string): string {
  const escaped = escapeHtml(markdown.normalize('NFC'));
  return escaped
    .split(/\r?\n/)
    .map((line) => {
      if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
      if (line.startsWith('&gt; ')) return `<blockquote>${line.slice(5)}</blockquote>`;
      if (!line.trim()) return '<br />';
      return `<p>${line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`;
    })
    .join('\n');
}

export function exportDocumentAsPrintableHtml(doc: ProductionDocument): string {
  const bodyHtml = markdownToSimpleHtml(doc.contentMarkdown);
  return `<!doctype html>
<html lang="${escapeHtml(doc.language)}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(doc.title)} (v${doc.version})</title>
  <style>
    body { font-family: "Noto Sans Ethiopic", "Segoe UI", system-ui, sans-serif; max-width: 820px; margin: 40px auto; color: #111827; line-height: 1.6; padding: 0 24px; }
    header { border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 24px; }
    .meta { font-size: 12px; color: #4b5563; }
    h1, h2, h3 { color: #0f172a; margin-top: 20px; }
    blockquote { border-left: 3px solid #6366f1; padding-left: 12px; color: #374151; margin: 12px 0; }
    @media print { body { margin: 16mm; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(doc.title)}</h1>
    <div class="meta">Type: ${escapeHtml(doc.type)} &middot; Version: v${doc.version} &middot; Status: ${escapeHtml(doc.status)} &middot; Language: ${escapeHtml(formatLanguageLabel(doc.language))} &middot; Updated: ${escapeHtml(doc.updatedAt)}</div>
  </header>
  <main>${bodyHtml}</main>
</body>
</html>`;
}

export function exportDocumentAsWordDoc(doc: ProductionDocument): string {
  // Word-compatible HTML MIME payload with UTF-8 charset + BOM support for Amharic/Tigrigna/Oromoo Unicode
  const html = exportDocumentAsPrintableHtml(doc).replace(
    '<html ',
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" '
  );
  return `\uFEFF${html}`;
}
