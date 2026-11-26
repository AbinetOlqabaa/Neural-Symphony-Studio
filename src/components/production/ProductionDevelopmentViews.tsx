import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Film,
  Link2,
  MessageSquare,
  Plus,
  Printer,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import { analyzeCharacterImpact, analyzeScreenplayImpact } from '../../modules/continuity/continuityEngine';
import {
  PRODUCTION_LANGUAGES,
  createProductionDocument,
  exportDocumentAsJson,
  exportDocumentAsMarkdown,
  exportDocumentAsPrintableHtml,
  exportDocumentAsWordDoc,
  formatLanguageLabel,
} from '../../modules/production/documentSystem';
import type {
  ContinuityAlert,
  DocumentStatus,
  DocumentType,
  ProductionCategory,
  ProductionLanguage,
  ScreenplaySceneSection,
} from '../../types/studio';

function downloadTextBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PRODUCTION_CATEGORIES: Array<{ value: ProductionCategory; label: string }> = [
  { value: 'music_video', label: 'Music Video' },
  { value: 'short_film', label: 'Short Film' },
  { value: 'feature_film', label: 'Feature Film' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'historical_documentary', label: 'Historical Documentary' },
  { value: 'commercial_ad', label: 'Commercial Advertisement' },
  { value: 'social_ad', label: 'Social Media Ad' },
  { value: 'educational', label: 'Educational Film' },
  { value: 'promotional', label: 'Promotional Film' },
  { value: 'training', label: 'Training Video' },
  { value: 'multilingual', label: 'Multilingual Production' },
];

export function CreativeDevelopmentView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  if (!project || !project.creativeBrief) return null;
  const brief = project.creativeBrief;
  const routePreview = store.resolveTaskPreview('screenplay_development');

  const handleAiExpandConcept = async () => {
    setAiBusy(true);
    setAiNotice(null);
    try {
      const prompt = [
        `Develop a structured Creative Brief JSON for this project.`,
        `Title: ${project.name}`,
        `Category: ${brief.category}`,
        `Primary Language: ${formatLanguageLabel(brief.primaryLanguage)}`,
        `Target Languages: ${brief.targetLanguages.map(formatLanguageLabel).join(', ')}`,
        `Concept: ${brief.concept || project.description}`,
        `Return JSON with keys: logline, synopsis, treatment, theme, targetAudience, visualDirection, objectives.`,
      ].join('\n');

      const res = await store.runOrchestratedPrompt({
        taskType: 'screenplay_development',
        prompt,
        systemInstruction:
          'You are a senior film & documentary development producer. Return valid JSON with keys logline, synopsis, treatment, theme, targetAudience, visualDirection, objectives.',
        responseJson: true,
      });

      setAiNotice(res.userNotice);
      try {
        const cleaned = res.outputText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleaned) as Record<string, string>;
        store.updateCreativeBrief({
          logline: parsed.logline || brief.logline,
          synopsis: parsed.synopsis || brief.synopsis,
          treatment: parsed.treatment || brief.treatment,
          theme: parsed.theme || brief.theme,
          targetAudience: parsed.targetAudience || brief.targetAudience,
          visualDirection: parsed.visualDirection || brief.visualDirection,
          objectives: parsed.objectives || brief.objectives,
        });
      } catch {
        store.updateCreativeBrief({ treatment: res.outputText });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI expansion failed';
      setAiNotice(msg);
      store.notify('error', msg);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Creative Development & Brief</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Transform an initial idea into a structured Creative Brief, Logline, Synopsis, Treatment, and multilingual target plan. Works fully manually or with routed AI assistance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => store.syncAutoDocsFromProject()}
            className="h-9 px-3 rounded-md border border-[var(--ns-border)] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[var(--ns-surface-elevated)]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync to Documents</span>
          </button>
          <button
            type="button"
            disabled={aiBusy || !routePreview.executable}
            onClick={() => void handleAiExpandConcept()}
            className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] disabled:opacity-45 text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{aiBusy ? 'Developing...' : 'AI Draft Brief & Treatment'}</span>
          </button>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-[var(--ns-surface)] border border-[var(--ns-border)] text-xs flex flex-wrap items-center justify-between gap-2">
        <span className="text-[var(--ns-text-muted)]">
          Task Routing Status: <strong className="text-[var(--ns-text)]">{routePreview.userNotice}</strong>
        </span>
        <button
          type="button"
          onClick={() => store.updateCreativeBrief({ approved: !brief.approved })}
          className={`h-7 px-3 rounded border text-xs font-medium ${
            brief.approved
              ? 'border-[var(--ns-success)] text-[var(--ns-success)] bg-[var(--ns-success)]/10'
              : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
          }`}
        >
          {brief.approved ? 'Brief Approved' : 'Mark Brief Approved'}
        </button>
      </div>

      {aiNotice && (
        <div className="p-3 rounded-lg bg-[var(--ns-surface-elevated)] border border-[var(--ns-accent-blue)] text-xs">
          {aiNotice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
        <div className="lg:col-span-5 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold">Production Parameters & Languages</h2>

          <div className="space-y-1">
            <label htmlFor="brief-category" className="block text-[var(--ns-text-muted)]">
              Production Category
            </label>
            <select
              id="brief-category"
              value={brief.category}
              onChange={(e) => store.updateCreativeBrief({ category: e.target.value as ProductionCategory })}
              className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            >
              {PRODUCTION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="brief-genre" className="block text-[var(--ns-text-muted)]">
                Genre / Style
              </label>
              <input
                id="brief-genre"
                type="text"
                value={brief.genre}
                onChange={(e) => store.updateCreativeBrief({ genre: e.target.value })}
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="brief-duration" className="block text-[var(--ns-text-muted)]">
                Intended Duration (sec)
              </label>
              <input
                id="brief-duration"
                type="number"
                min={5}
                value={brief.intendedDurationSec}
                onChange={(e) =>
                  store.updateCreativeBrief({ intendedDurationSec: Math.max(5, Number(e.target.value) || 60) })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="brief-primary-lang" className="block text-[var(--ns-text-muted)]">
              Primary Production Language
            </label>
            <select
              id="brief-primary-lang"
              value={brief.primaryLanguage}
              onChange={(e) => store.updateCreativeBrief({ primaryLanguage: e.target.value as ProductionLanguage })}
              className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            >
              {PRODUCTION_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {formatLanguageLabel(l.code)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[var(--ns-text-muted)]">Target Distribution Languages</span>
            <div className="grid grid-cols-2 gap-2">
              {PRODUCTION_LANGUAGES.map((l) => {
                const checked = brief.targetLanguages.includes(l.code);
                return (
                  <label
                    key={l.code}
                    className="flex items-center gap-2 p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? Array.from(new Set([...brief.targetLanguages, l.code]))
                          : brief.targetLanguages.filter((x) => x !== l.code);
                        store.updateCreativeBrief({ targetLanguages: next });
                      }}
                    />
                    <span>{formatLanguageLabel(l.code)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="brief-audience" className="block text-[var(--ns-text-muted)]">
              Target Audience
            </label>
            <input
              id="brief-audience"
              type="text"
              value={brief.targetAudience}
              onChange={(e) => store.updateCreativeBrief({ targetAudience: e.target.value })}
              placeholder="International documentary festivals, cultural broadcast..."
              className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="brief-theme" className="block text-[var(--ns-text-muted)]">
              Theme
            </label>
            <input
              id="brief-theme"
              type="text"
              value={brief.theme}
              onChange={(e) => store.updateCreativeBrief({ theme: e.target.value })}
              className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            />
          </div>
        </div>

        <div className="lg:col-span-7 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold">Narrative Development Artifacts</h2>

          <div className="space-y-1">
            <label htmlFor="brief-concept" className="block text-[var(--ns-text-muted)]">
              Core Concept / Initial Idea
            </label>
            <textarea
              id="brief-concept"
              rows={2}
              value={brief.concept}
              onChange={(e) => store.updateCreativeBrief({ concept: e.target.value })}
              placeholder="e.g., A 15-minute documentary exploring historical architecture, traditional music, and community life..."
              className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="brief-logline" className="block text-[var(--ns-text-muted)]">
              Logline
            </label>
            <input
              id="brief-logline"
              type="text"
              value={brief.logline}
              onChange={(e) => store.updateCreativeBrief({ logline: e.target.value })}
              placeholder="One-sentence dramatic or documentary hook..."
              className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="brief-synopsis" className="block text-[var(--ns-text-muted)]">
              Synopsis
            </label>
            <textarea
              id="brief-synopsis"
              rows={3}
              value={brief.synopsis}
              onChange={(e) => store.updateCreativeBrief({ synopsis: e.target.value })}
              className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="brief-treatment" className="block text-[var(--ns-text-muted)]">
              Director Treatment
            </label>
            <textarea
              id="brief-treatment"
              rows={4}
              value={brief.treatment}
              onChange={(e) => store.updateCreativeBrief({ treatment: e.target.value })}
              className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="brief-visual-dir" className="block text-[var(--ns-text-muted)]">
                Visual Direction
              </label>
              <textarea
                id="brief-visual-dir"
                rows={3}
                value={brief.visualDirection}
                onChange={(e) => store.updateCreativeBrief({ visualDirection: e.target.value })}
                className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="brief-objectives" className="block text-[var(--ns-text-muted)]">
                Production Objectives
              </label>
              <textarea
                id="brief-objectives"
                rows={3}
                value={brief.objectives}
                onChange={(e) => store.updateCreativeBrief({ objectives: e.target.value })}
                className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScreenplayStudioView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const sections = (project?.screenplay || []).slice().sort((a, b) => a.order - b.order);
  const [selectedId, setSelectedId] = useState<string>('');
  const [newDialogueText, setNewDialogueText] = useState('');
  const [newDialogueSpeaker, setNewDialogueSpeaker] = useState('');
  const [newDialogueLang, setNewDialogueLang] = useState<ProductionLanguage>('ti');

  if (!project) return null;
  const active = sections.find((s) => s.id === selectedId) || sections[0];
  const impact = active ? analyzeScreenplayImpact(project, active.id) : null;

  const handleAddSection = () => {
    const order = sections.length + 1;
    const now = new Date().toISOString();
    const created: ScreenplaySceneSection = {
      id: `scr_${Date.now().toString(36)}`,
      order,
      actNumber: 1,
      sequenceName: `Sequence ${order}`,
      slugline: `EXT. NORTHERN HIGHLANDS - DAWN`,
      sceneType: project.creativeBrief?.category === 'documentary' ? 'documentary' : 'screenplay',
      actionDescription: 'Describe visual camera action and subject movement.',
      narration: '',
      dialogueBlocks: [],
      estimatedDurationSec: 6,
      revision: 1,
      approved: false,
      updatedAt: now,
      versionHistory: [{ version: 1, createdAt: now, summary: 'Initial draft', snapshotText: '' }],
    };
    store.upsertScreenplaySection(created);
    setSelectedId(created.id);
    store.notify('success', `Added screenplay section "${created.slugline}"`);
  };

  const handleSaveRevision = (section: ScreenplaySceneSection) => {
    const now = new Date().toISOString();
    const nextRev = section.revision + 1;
    store.upsertScreenplaySection({
      ...section,
      revision: nextRev,
      approved: false,
      updatedAt: now,
      versionHistory: [
        ...section.versionHistory,
        {
          version: nextRev,
          createdAt: now,
          summary: `Manual revision v${nextRev}`,
          snapshotText: `${section.actionDescription}\n${section.narration}`.trim(),
        },
      ],
    });
    store.notify('success', `Saved script revision v${nextRev} (marked for continuity review)`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Screenplay & Script Studio</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Author screenplay, documentary, advertisement, and multilingual dialogue (English, አማርኛ, Afaan Oromoo, ትግርኛ) traced directly to Scene Planner scenes.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddSection}
          className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Script Scene</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start text-xs">
        <div className="lg:col-span-4 space-y-2">
          {sections.map((sec) => {
            const isSel = active?.id === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedId(sec.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors space-y-1 ${
                  isSel
                    ? 'bg-[var(--ns-surface-elevated)] border-[var(--ns-accent)]'
                    : 'bg-[var(--ns-surface)] border-[var(--ns-border)] hover:border-[var(--ns-border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold truncate">{sec.slugline}</span>
                  <span className={sec.approved ? 'text-[var(--ns-success)]' : 'text-[var(--ns-warning)]'}>
                    v{sec.revision}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--ns-text-subtle)] truncate">
                  Act {sec.actNumber} · {sec.sequenceName} · {sec.linkedSceneId ? 'Linked to Scene' : 'Unlinked'}
                </div>
              </button>
            );
          })}
        </div>

        {active && (
          <div className="lg:col-span-8 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-display text-sm font-semibold">{active.slugline}</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => store.syncScreenplaySectionToScene(active)}
                  className="h-8 px-3 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)] inline-flex items-center gap-1.5"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>{active.linkedSceneId ? 'Sync to Linked Scene' : 'Create & Link Scene'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveRevision(active)}
                  className="h-8 px-3 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)]"
                >
                  Snapshot Revision (v{active.revision + 1})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    store.upsertScreenplaySection({ ...active, approved: !active.approved })
                  }
                  className={`h-8 px-3 rounded border font-medium ${
                    active.approved
                      ? 'border-[var(--ns-success)] text-[var(--ns-success)]'
                      : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                  }`}
                >
                  {active.approved ? 'Approved' : 'Approve Scene'}
                </button>
              </div>
            </div>

            {impact && (
              <div className="p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-[11px] text-[var(--ns-text-muted)] flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span>{impact.summary}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6 space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Slugline / Scene Heading</label>
                <input
                  type="text"
                  value={active.slugline}
                  onChange={(e) => store.upsertScreenplaySection({ ...active, slugline: e.target.value })}
                  className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Linked Scene</label>
                <select
                  value={active.linkedSceneId || ''}
                  onChange={(e) =>
                    store.upsertScreenplaySection({ ...active, linkedSceneId: e.target.value || undefined })
                  }
                  className="w-full h-8 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                >
                  <option value="">Unlinked</option>
                  {project.scenes.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3 space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Est. Duration (s)</label>
                <input
                  type="number"
                  min={1}
                  value={active.estimatedDurationSec}
                  onChange={(e) =>
                    store.upsertScreenplaySection({
                      ...active,
                      estimatedDurationSec: Math.max(1, Number(e.target.value) || 4),
                    })
                  }
                  className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Visual Action Description</label>
              <textarea
                rows={3}
                value={active.actionDescription}
                onChange={(e) =>
                  store.upsertScreenplaySection({ ...active, actionDescription: e.target.value })
                }
                className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Narration / Voiceover</label>
              <textarea
                rows={2}
                value={active.narration}
                onChange={(e) => store.upsertScreenplaySection({ ...active, narration: e.target.value })}
                placeholder="Documentary voiceover or lyrical narration (English, አማርኛ, Afaan Oromoo, ትግርኛ)..."
                className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>

            <div className="pt-2 border-t border-[var(--ns-border)] space-y-3">
              <div className="font-medium">Dialogue & Multilingual Lines ({active.dialogueBlocks.length})</div>

              {active.dialogueBlocks.map((dlg) => (
                <div
                  key={dlg.id}
                  className="p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium">
                      {dlg.speakerName} ·{' '}
                      <span className="text-[var(--ns-accent-blue)]">{formatLanguageLabel(dlg.language)}</span>
                    </div>
                    <div className="text-sm">{dlg.text}</div>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove dialogue block"
                    onClick={() =>
                      store.upsertScreenplaySection({
                        ...active,
                        dialogueBlocks: active.dialogueBlocks.filter((d) => d.id !== dlg.id),
                      })
                    }
                    className="p-1 text-[var(--ns-danger)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  value={newDialogueSpeaker}
                  onChange={(e) => setNewDialogueSpeaker(e.target.value)}
                  placeholder="Speaker / Narrator"
                  className="sm:col-span-3 h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
                <select
                  aria-label="Dialogue language"
                  value={newDialogueLang}
                  onChange={(e) => setNewDialogueLang(e.target.value as ProductionLanguage)}
                  className="sm:col-span-3 h-8 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                >
                  {PRODUCTION_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {formatLanguageLabel(l.code)}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newDialogueText}
                  onChange={(e) => setNewDialogueText(e.target.value)}
                  placeholder="Dialogue or lyric line (supports ትግርኛ / አማርኛ)..."
                  className="sm:col-span-4 h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newDialogueText.trim()) return;
                    store.upsertScreenplaySection({
                      ...active,
                      dialogueBlocks: [
                        ...active.dialogueBlocks,
                        {
                          id: `dlg_${Date.now().toString(36)}`,
                          speakerName: newDialogueSpeaker.trim() || 'Narrator',
                          language: newDialogueLang,
                          text: newDialogueText.trim().normalize('NFC'),
                        },
                      ],
                    });
                    setNewDialogueText('');
                  }}
                  className="sm:col-span-2 h-8 px-3 rounded border border-[var(--ns-border)] bg-[var(--ns-surface-elevated)] font-medium"
                >
                  Add Line
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const DOC_TYPES: Array<{ value: DocumentType; label: string }> = [
  { value: 'creative_brief', label: 'Creative Brief' },
  { value: 'screenplay', label: 'Screenplay / Script' },
  { value: 'breakdown', label: 'Production Breakdown' },
  { value: 'character_bible', label: 'Character Bible' },
  { value: 'costume_bible', label: 'Costume & Wardrobe Bible' },
  { value: 'location_bible', label: 'Location Bible' },
  { value: 'props_inventory', label: 'Props & Set Design' },
  { value: 'storyboard', label: 'Storyboard Plan' },
  { value: 'shot_list', label: 'Shot List' },
  { value: 'production_schedule', label: 'Production Schedule' },
  { value: 'preproduction_package', label: 'Complete Pre-Production Package' },
];

export function ProductionDocumentsView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const docs = project?.productionDocuments || [];
  const [selectedId, setSelectedId] = useState<string>('');
  const [draftContent, setDraftContent] = useState<string>('');
  const [commentText, setCommentText] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState<DocumentType>('costume_bible');
  const [newDocLang, setNewDocLang] = useState<ProductionLanguage>('en');

  if (!project) return null;
  const activeDoc = docs.find((d) => d.id === selectedId) || docs[0];
  const editorValue = selectedId === activeDoc?.id && draftContent !== '' ? draftContent : activeDoc?.contentMarkdown || '';

  const handleCreateDoc = () => {
    if (!newDocTitle.trim()) {
      store.notify('error', 'Document title is required.');
      return;
    }
    const created = createProductionDocument({
      type: newDocType,
      title: newDocTitle.trim(),
      language: newDocLang,
      contentMarkdown: `# ${newDocTitle.trim()}\n\n## Overview\nStructured production notes for ${project.name}.\n`,
    });
    store.upsertProductionDocument(created);
    setSelectedId(created.id);
    setDraftContent('');
    setNewDocTitle('');
    store.notify('success', `Created "${created.title}"`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Production Document Manager</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Unified editable production artifacts with version history, approvals, review comments, and Unicode-safe Markdown, JSON, Printable PDF, and Word exports.
          </p>
        </div>

        <button
          type="button"
          onClick={() => store.syncAutoDocsFromProject()}
          className="h-9 px-3.5 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs font-medium inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Structured Docs from Project</span>
        </button>
      </div>

      {/* Create New Document Bar */}
      <div className="p-4 rounded-lg bg-[var(--ns-surface)] border border-[var(--ns-border)] grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-center">
        <input
          type="text"
          value={newDocTitle}
          onChange={(e) => setNewDocTitle(e.target.value)}
          placeholder="New document title (e.g., Northern Ethiopia Wardrobe Bible)..."
          className="sm:col-span-5 h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
        />
        <select
          aria-label="New document type"
          value={newDocType}
          onChange={(e) => setNewDocType(e.target.value as DocumentType)}
          className="sm:col-span-3 h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
        >
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          aria-label="New document language"
          value={newDocLang}
          onChange={(e) => setNewDocLang(e.target.value as ProductionLanguage)}
          className="sm:col-span-2 h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
        >
          {PRODUCTION_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {formatLanguageLabel(l.code)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleCreateDoc}
          className="sm:col-span-2 h-9 px-3 rounded bg-[var(--ns-accent)] text-white font-medium inline-flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Doc</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start text-xs">
        {/* Document List */}
        <div className="lg:col-span-4 space-y-2">
          {docs.map((doc) => {
            const isSel = activeDoc?.id === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  setSelectedId(doc.id);
                  setDraftContent(doc.contentMarkdown);
                }}
                className={`w-full text-left p-3 rounded-lg border space-y-1 ${
                  isSel
                    ? 'bg-[var(--ns-surface-elevated)] border-[var(--ns-accent)]'
                    : 'bg-[var(--ns-surface)] border-[var(--ns-border)] hover:border-[var(--ns-border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--ns-text-subtle)]" />
                    <span className="truncate">{doc.title}</span>
                  </span>
                  <span className="font-mono text-[11px] tabular-nums">v{doc.version}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--ns-text-subtle)]">
                  <span>{doc.type.replace(/_/g, ' ')} · {formatLanguageLabel(doc.language)}</span>
                  <span
                    className={
                      doc.status === 'approved'
                        ? 'text-[var(--ns-success)]'
                        : doc.status === 'in_review'
                        ? 'text-[var(--ns-warning)]'
                        : ''
                    }
                  >
                    {doc.status.replace('_', ' ')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Document Editor, Versioning & Exports */}
        {activeDoc && (
          <div className="lg:col-span-8 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold">{activeDoc.title}</h2>
                <div className="text-[11px] text-[var(--ns-text-subtle)] tabular-nums">
                  Version v{activeDoc.version} · {activeDoc.versionHistory.length} snapshot(s) ·{' '}
                  {activeDoc.linkedSceneIds.length} scene link(s)
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Document approval status"
                  value={activeDoc.status}
                  onChange={(e) => store.setDocumentApproval(activeDoc.id, e.target.value as DocumentStatus)}
                  className="h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                >
                  <option value="draft">Draft</option>
                  <option value="in_review">In Review</option>
                  <option value="approved">Approved</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    store.updateDocumentWithVersion(activeDoc.id, {
                      contentMarkdown: editorValue,
                      summary: `Manual edit v${activeDoc.version + 1}`,
                    });
                  }}
                  className="h-8 px-3.5 rounded bg-[var(--ns-accent)] text-white font-medium"
                >
                  Save New Version
                </button>
              </div>
            </div>

            <textarea
              rows={13}
              aria-label="Production document markdown editor"
              value={editorValue}
              onChange={(e) => {
                setSelectedId(activeDoc.id);
                setDraftContent(e.target.value);
              }}
              className="w-full p-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono text-xs leading-relaxed"
            />

            {/* Export Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  downloadTextBlob(
                    `${activeDoc.id}_v${activeDoc.version}.md`,
                    exportDocumentAsMarkdown(activeDoc),
                    'text/markdown;charset=utf-8'
                  )
                }
                className="h-8 px-3 rounded border border-[var(--ns-border)] inline-flex items-center gap-1.5 hover:bg-[var(--ns-surface-elevated)]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Markdown (.md)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadTextBlob(
                    `${activeDoc.id}_v${activeDoc.version}.json`,
                    exportDocumentAsJson(activeDoc),
                    'application/json;charset=utf-8'
                  )
                }
                className="h-8 px-3 rounded border border-[var(--ns-border)] inline-flex items-center gap-1.5 hover:bg-[var(--ns-surface-elevated)]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON (.json)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadTextBlob(
                    `${activeDoc.id}_v${activeDoc.version}_printable.html`,
                    exportDocumentAsPrintableHtml(activeDoc),
                    'text/html;charset=utf-8'
                  )
                }
                className="h-8 px-3 rounded border border-[var(--ns-border)] inline-flex items-center gap-1.5 hover:bg-[var(--ns-surface-elevated)]"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Printable PDF HTML</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadTextBlob(
                    `${activeDoc.id}_v${activeDoc.version}.doc`,
                    exportDocumentAsWordDoc(activeDoc),
                    'application/msword;charset=utf-8'
                  )
                }
                className="h-8 px-3 rounded border border-[var(--ns-border)] inline-flex items-center gap-1.5 hover:bg-[var(--ns-surface-elevated)]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Word (.doc)</span>
              </button>
            </div>

            {/* Review Comments & Version History */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--ns-border)]">
              <div className="space-y-2">
                <div className="font-medium flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Review Comments ({activeDoc.comments.length})</span>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {activeDoc.comments.map((c) => (
                    <div
                      key={c.id}
                      className="p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    >
                      <div className="text-[11px] font-medium">{c.author}</div>
                      <div>{c.text}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add review note..."
                    className="flex-1 h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!commentText.trim()) return;
                      store.addDocumentCommentToDoc(activeDoc.id, 'Director', commentText);
                      setCommentText('');
                    }}
                    className="h-8 px-3 rounded border border-[var(--ns-border)]"
                  >
                    Post
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-medium">Version History ({activeDoc.versionHistory.length})</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {activeDoc.versionHistory
                    .slice()
                    .reverse()
                    .map((vh) => (
                      <div
                        key={vh.version}
                        className="p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] flex items-center justify-between gap-2"
                      >
                        <div className="truncate">
                          <span className="font-mono font-medium">v{vh.version}</span> · {vh.summary}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(activeDoc.id);
                            setDraftContent(vh.contentMarkdown);
                          }}
                          className="text-[var(--ns-accent-blue)] whitespace-nowrap"
                        >
                          Load Draft
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ContinuityDashboardView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ContinuityAlert['category']>('costume');
  const [selectedCharId, setSelectedCharId] = useState('');
  const [filterClassification, setFilterClassification] = useState<
    'all' | 'critical' | 'warning' | 'informational'
  >('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'resolved'>('all');
  const [explanationDrafts, setExplanationDrafts] = useState<Record<string, string>>({});

  if (!project) return null;
  const charImpact = selectedCharId ? analyzeCharacterImpact(project, selectedCharId) : null;
  const unresolvedCount = store.continuityAlerts.filter((a) => !a.resolved).length;
  const criticalCount = store.continuityAlerts.filter(
    (a) => !a.resolved && a.classification === 'critical'
  ).length;

  const filteredAlerts = store.continuityAlerts.filter((a) => {
    if (statusFilter === 'active' && a.resolved) return false;
    if (statusFilter === 'resolved' && !a.resolved) return false;
    if (filterClassification !== 'all' && a.classification !== filterClassification) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Production Continuity Dashboard</h1>
        <p className="text-xs text-[var(--ns-text-muted)] mt-1">
          Tracks relationships across screenplay scenes, characters, costumes, locations, props, storyboards, and shot lists. Approved records are never overwritten automatically; mark intentional variations with production explanations.
        </p>
      </div>

      {/* Change Impact Inspector */}
      <section className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-3 text-xs">
        <h2 className="font-display text-sm font-semibold">Character Change Impact Inspector</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <select
            aria-label="Inspect character change impact"
            value={selectedCharId}
            onChange={(e) => setSelectedCharId(e.target.value)}
            className="h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] max-w-xs"
          >
            <option value="">Select character to trace dependencies...</option>
            {project.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.label})
              </option>
            ))}
          </select>
          {charImpact && <span className="text-[var(--ns-text-muted)]">{charImpact.summary}</span>}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start text-xs">
        {/* Log Manual Report */}
        <div className="lg:col-span-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-3">
          <h2 className="font-display text-sm font-semibold">Log Manual Continuity Issue</h2>
          <div className="space-y-1">
            <label className="block text-[var(--ns-text-muted)]">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ContinuityAlert['category'])}
              className="w-full h-8 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            >
              <option value="character">Character Identity</option>
              <option value="costume">Costume / Wardrobe</option>
              <option value="location">Location / Lighting</option>
              <option value="props">Props & Set State</option>
              <option value="screenplay">Screenplay / Script</option>
              <option value="storyboard">Storyboard</option>
              <option value="shots">Shot List / Cinematography</option>
              <option value="reference">Reference Assets</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[var(--ns-text-muted)]">Issue Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Check shawl pattern in Scene 3"
              className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[var(--ns-text-muted)]">Details</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!title.trim()) return;
              store.addManualContinuityAlert({
                title,
                description,
                category,
                severity: 'warning',
                affectedEntityIds: [],
              });
              setTitle('');
              setDescription('');
            }}
            className="w-full h-9 rounded bg-[var(--ns-accent)] text-white font-medium"
          >
            Report Manual Review Note
          </button>
        </div>

        {/* Alert Feed */}
        <div className="lg:col-span-8 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold tabular-nums">
              Continuity Checks ({unresolvedCount} active · {criticalCount} critical · {store.continuityAlerts.length} total)
            </h2>
            <div className="flex items-center gap-2">
              <select
                aria-label="Filter continuity alerts by classification"
                value={filterClassification}
                onChange={(e) =>
                  setFilterClassification(
                    e.target.value as 'all' | 'critical' | 'warning' | 'informational'
                  )
                }
                className="h-8 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="all">All Levels</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="informational">Informational</option>
              </select>
              <select
                aria-label="Filter continuity alerts by resolution status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'active' | 'all' | 'resolved')}
                className="h-8 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="resolved">Resolved / Intentional</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredAlerts.length === 0 ? (
              <div className="p-6 text-center rounded border border-[var(--ns-border)] text-[var(--ns-text-muted)]">
                No continuity findings match the current filter.
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const draftExp =
                  explanationDrafts[alert.id] !== undefined
                    ? explanationDrafts[alert.id]
                    : alert.explanation || '';
                return (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded border space-y-2 ${
                      alert.resolved
                        ? 'bg-[var(--ns-surface-inset)] border-[var(--ns-border)] opacity-75'
                        : 'bg-[var(--ns-surface-inset)] border-[var(--ns-border-strong)]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium">
                        {alert.classification === 'critical' || alert.severity === 'action_required' ? (
                          <ShieldAlert className="w-4 h-4 text-[var(--ns-danger)] shrink-0" />
                        ) : alert.classification === 'warning' || alert.severity === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-[var(--ns-warning)] shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-[var(--ns-accent-blue)] shrink-0" />
                        )}
                        <span>{alert.title}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {alert.affectedSection && (
                          <button
                            type="button"
                            onClick={() => store.setActiveSection(alert.affectedSection!)}
                            className="h-7 px-2.5 rounded border border-[var(--ns-border)] text-[11px] text-[var(--ns-accent-blue)] hover:bg-[var(--ns-surface)] whitespace-nowrap"
                          >
                            Open Record
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => store.toggleContinuityAlertResolved(alert.id)}
                          className="h-7 px-2.5 rounded border border-[var(--ns-border)] text-[11px] whitespace-nowrap"
                        >
                          {alert.resolved ? 'Reopen' : 'Mark Resolved'}
                        </button>
                      </div>
                    </div>

                    <p className="text-[var(--ns-text-muted)]">{alert.description}</p>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--ns-text-subtle)]">
                      <span>
                        {alert.classification || 'warning'} ·{' '}
                        {alert.source === 'manual' ? 'Manual Report' : 'Automated Scan'} · Category:{' '}
                        {alert.category}
                        {alert.intentionalDifference ? ' · Intentional Variation' : ''}
                      </span>
                    </div>

                    {/* Intentional creative variation documentation */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-[var(--ns-border)]">
                      <input
                        type="text"
                        aria-label={`Explanation for ${alert.title}`}
                        placeholder="Optional creative explanation if this difference is intentional..."
                        value={draftExp}
                        onChange={(e) =>
                          setExplanationDrafts((prev) => ({ ...prev, [alert.id]: e.target.value }))
                        }
                        className="flex-1 h-7 px-2.5 rounded bg-[var(--ns-surface)] border border-[var(--ns-border)] text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          store.markContinuityIntentional(
                            alert.id,
                            !alert.intentionalDifference,
                            draftExp
                          )
                        }
                        className="h-7 px-2.5 rounded border border-[var(--ns-border)] text-[11px] whitespace-nowrap hover:bg-[var(--ns-surface)]"
                      >
                        {alert.intentionalDifference ? 'Unmark Intentional' : 'Mark Intentional'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
