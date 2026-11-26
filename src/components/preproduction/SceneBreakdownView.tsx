import { useState } from 'react';
import { BookOpen, Check, Link2, Sparkles, Wand2 } from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import {
  applyBreakdownDraftToScene,
  extractBreakdownDraftFromScreenplay,
  type BreakdownDraftSuggestion,
} from '../../modules/production/preProductionEngine';
import type { InteriorExterior, ScenePlan } from '../../types/studio';

export function SceneBreakdownView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  const [selectedScreenplayId, setSelectedScreenplayId] = useState<string>('');
  const [pendingDraft, setPendingDraft] = useState<BreakdownDraftSuggestion | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiReviewBusy, setAiReviewBusy] = useState(false);
  const [aiReviewNotes, setAiReviewNotes] = useState<{
    missingElements?: string[];
    suggestedShots?: string[];
    lightingNotes?: string;
    promptGuidance?: string;
    raw?: string;
  } | null>(null);

  if (!project) return null;

  const sortedScenes = project.scenes.slice().sort((a, b) => a.order - b.order);
  const scene = sortedScenes.find((s) => s.id === selectedSceneId) || sortedScenes[0];
  const screenplaySections = (project.screenplay || []).slice().sort((a, b) => a.order - b.order);
  const activeScr =
    screenplaySections.find((s) => s.id === (selectedScreenplayId || scene?.sourceScreenplayId)) ||
    screenplaySections.find((s) => s.linkedSceneId === scene?.id) ||
    screenplaySections[0];

  const routePreview = store.resolveTaskPreview('screenplay_development');

  const handleDeterministicExtract = () => {
    if (!activeScr) {
      store.notify('error', 'No screenplay section available to extract from.');
      return;
    }
    const draft = extractBreakdownDraftFromScreenplay(activeScr, project);
    setPendingDraft({
      ...draft,
      targetSceneId: scene?.id || draft.targetSceneId,
    });
  };

  const handleAiExtract = async () => {
    if (!activeScr) return;
    setAiBusy(true);
    try {
      const prompt = [
        `Extract a structured Scene Breakdown from ONLY this screenplay section (non-destructive review draft):`,
        `Slugline: ${activeScr.slugline}`,
        `Action: ${activeScr.actionDescription}`,
        `Narration: ${activeScr.narration}`,
        `Dialogue: ${activeScr.dialogueBlocks.map((d) => `${d.speakerName}: ${d.text}`).join(' | ')}`,
        `Known Characters: ${project.characters.map((c) => c.name).join(', ')}`,
        `Known Locations: ${(project.locations || []).map((l) => l.name).join(', ')}`,
        `Known Props: ${(project.props || []).map((p) => p.name).join(', ')}`,
        `Return JSON with keys: interiorExterior (INT|EXT|INT/EXT), timeOfDay, locationLabel, actionsSummary, dialogueSummary, importantObjects, environmentalConditions, emotionalTone.`,
      ].join('\n');

      const res = await store.runOrchestratedPrompt({
        taskType: 'screenplay_development',
        prompt,
        systemInstruction:
          'You are a first AD creating a structured scene breakdown from one screenplay scene. Return strict JSON only.',
        responseJson: true,
      });

      const base = extractBreakdownDraftFromScreenplay(activeScr, project);
      const cleaned = res.outputText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned) as Record<string, string>;
      setPendingDraft({
        ...base,
        targetSceneId: scene?.id || base.targetSceneId,
        interiorExterior:
          parsed.interiorExterior === 'INT' ||
          parsed.interiorExterior === 'EXT' ||
          parsed.interiorExterior === 'INT/EXT'
            ? parsed.interiorExterior
            : base.interiorExterior,
        timeOfDay: parsed.timeOfDay || base.timeOfDay,
        locationLabel: parsed.locationLabel || base.locationLabel,
        actionsSummary: parsed.actionsSummary || base.actionsSummary,
        dialogueSummary: parsed.dialogueSummary || base.dialogueSummary,
        importantObjects: parsed.importantObjects || base.importantObjects,
        environmentalConditions: parsed.environmentalConditions || base.environmentalConditions,
        emotionalTone: parsed.emotionalTone || base.emotionalTone,
      });
    } catch (err) {
      store.notify('error', err instanceof Error ? err.message : 'AI extraction failed');
    } finally {
      setAiBusy(false);
    }
  };

  const handleAiSceneReview = async () => {
    if (!scene) return;
    setAiReviewBusy(true);
    try {
      const linkedLoc = (project.locations || []).find((l) => l.id === scene.locationId);
      const linkedChars = project.characters.filter((c) => scene.characterIds.includes(c.id));
      const linkedCostumes = (project.costumes || []).filter(
        (co) => (scene.costumeIds || []).includes(co.id) || co.sceneIds.includes(scene.id)
      );
      const linkedProps = (project.props || []).filter(
        (p) => (scene.propIds || []).includes(p.id) || p.sceneIds.includes(scene.id)
      );

      // Strictly scoped scene + linked bible context only (no full project dump, no credentials)
      const scopedContext = {
        sceneTitle: scene.title,
        description: scene.description,
        interiorExterior: scene.interiorExterior,
        timeOfDay: scene.timeOfDay,
        location: linkedLoc ? { name: linkedLoc.name, lighting: linkedLoc.lighting, weather: linkedLoc.weather } : null,
        characters: linkedChars.map((c) => ({ name: c.name, clothing: c.clothing, hairstyle: c.hairstyle })),
        costumes: linkedCostumes.map((co) => co.name || co.garmentDescription),
        props: linkedProps.map((p) => p.name),
        storyboardFrameCount: (project.storyboardFrames || []).filter((f) => f.sceneId === scene.id).length,
        shotCount: (project.shotList || []).filter((sh) => sh.sceneId === scene.id).length,
      };

      const res = await store.runOrchestratedPrompt({
        taskType: 'screenplay_development',
        prompt: `Review this single scene pre-production context and return JSON with keys: missingElements (string[]), suggestedShots (string[]), lightingNotes (string), promptGuidance (string).\nContext:\n${JSON.stringify(
          scopedContext,
          null,
          2
        )}`,
        systemInstruction:
          'You are a pre-production supervisor reviewing a single scene. Do not invent project facts outside the provided context. Return JSON only.',
        responseJson: true,
      });

      const cleaned = res.outputText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      try {
        const parsed = JSON.parse(cleaned) as {
          missingElements?: string[];
          suggestedShots?: string[];
          lightingNotes?: string;
          promptGuidance?: string;
        };
        setAiReviewNotes(parsed);
      } catch {
        setAiReviewNotes({ raw: res.outputText });
      }
    } catch (err) {
      store.notify('error', err instanceof Error ? err.message : 'AI scene review failed');
    } finally {
      setAiReviewBusy(false);
    }
  };

  const toggleSceneListId = (field: 'characterIds' | 'costumeIds' | 'propIds', id: string) => {
    if (!scene) return;
    store.updateScene(scene.id, (s) => {
      const current = s[field] || [];
      const exists = current.includes(id);
      return {
        ...s,
        [field]: exists ? current.filter((x) => x !== id) : [...current, id],
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Scene Breakdown Studio</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Connect Screenplay sections to formal Locations, Characters, Costumes, Props, wardrobe notes, and production complexity with non-destructive review.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDeterministicExtract}
            disabled={!activeScr}
            className="h-9 px-3 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] hover:bg-[var(--ns-surface-elevated)] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-45"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Extract from Screenplay</span>
          </button>
          <button
            type="button"
            disabled={aiBusy || !activeScr || !routePreview.executable}
            onClick={() => void handleAiExtract()}
            title={routePreview.userNotice}
            className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] disabled:opacity-45 text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{aiBusy ? 'Extracting...' : 'AI Breakdown Assist'}</span>
          </button>
        </div>
      </div>

      {/* Screenplay Source Bar */}
      <div className="p-3.5 rounded-lg bg-[var(--ns-surface)] border border-[var(--ns-border)] grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-center">
        <div className="md:col-span-5 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2">
          <label htmlFor="bd-screenplay-select" className="text-[var(--ns-text-muted)] whitespace-nowrap shrink-0">
            Source Screenplay Section:
          </label>
          <select
            id="bd-screenplay-select"
            value={activeScr?.id || ''}
            onChange={(e) => setSelectedScreenplayId(e.target.value)}
            className="w-full min-w-0 flex-1 h-8 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
          >
            {screenplaySections.length === 0 ? (
              <option value="">No screenplay sections available</option>
            ) : (
              screenplaySections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.slugline} (v{sec.revision})
                </option>
              ))
            )}
          </select>
        </div>
        <div className="md:col-span-7 min-w-0 text-[11px] text-[var(--ns-text-muted)] truncate">
          {scene?.sourceScreenplayId
            ? `Linked Source: ${scene.sourceScreenplayId} (v${scene.sourceScreenplayVersion || 1}) · "${(
                scene.sourceScreenplayPassage || ''
              ).slice(0, 72)}"`
            : 'Manual breakdown mode · Extraction never overwrites approved scenes without your confirmation.'}
        </div>
      </div>

      {pendingDraft && scene && (
        <div className="p-4 rounded-lg border border-[var(--ns-accent)] bg-[var(--ns-surface)] space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">
              Review Extracted Breakdown Draft for "{scene.title}" (Source: {pendingDraft.slugline} v
              {pendingDraft.sourceScreenplayVersion})
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  store.updateScene(scene.id, (s) => applyBreakdownDraftToScene(s, pendingDraft));
                  setPendingDraft(null);
                  store.notify('success', `Applied reviewed breakdown to "${scene.title}"`);
                }}
                className="h-8 px-3 rounded bg-[var(--ns-accent)] text-white font-medium inline-flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve & Apply to Scene</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingDraft(null)}
                className="h-8 px-3 rounded border border-[var(--ns-border)]"
              >
                Dismiss
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]">
              <strong>Setting:</strong> {pendingDraft.interiorExterior} · {pendingDraft.locationLabel} ·{' '}
              {pendingDraft.timeOfDay}
            </div>
            <div className="p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]">
              <strong>Matched Cast / Props:</strong> {pendingDraft.matchedCharacterIds.length} char(s) ·{' '}
              {pendingDraft.matchedPropIds.length} prop(s)
            </div>
            <div className="p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]">
              <strong>Mood & Weather:</strong> {pendingDraft.emotionalTone} · {pendingDraft.environmentalConditions}
            </div>
          </div>
          <div className="text-[11px] text-[var(--ns-text-muted)]">
            <strong>Action Summary:</strong> {pendingDraft.actionsSummary}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start text-xs">
        <div className="lg:col-span-4 space-y-2">
          {sortedScenes.length === 0 ? (
            <div className="p-4 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-text-muted)]">
              No scenes in project yet. Create scenes in Scene Planner or Screenplay Studio.
            </div>
          ) : (
            sortedScenes.map((sc) => {
              const isSel = scene?.id === sc.id;
              const loc = (project.locations || []).find((l) => l.id === sc.locationId);
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    setSelectedSceneId(sc.id);
                    setAiReviewNotes(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg border space-y-1 transition-colors ${
                    isSel
                      ? 'border-[var(--ns-accent)] bg-[var(--ns-surface-elevated)]'
                      : 'border-[var(--ns-border)] bg-[var(--ns-surface)] hover:border-[var(--ns-border-strong)]'
                  }`}
                >
                  <div className="font-semibold truncate">{sc.title}</div>
                  <div className="text-[11px] text-[var(--ns-text-muted)] truncate">
                    {sc.interiorExterior || 'EXT'} · {sc.timeOfDay || 'Day'} · {loc?.name || 'Location unlinked'}
                  </div>
                  <div className="text-[11px] text-[var(--ns-text-subtle)] tabular-nums">
                    {sc.characterIds.length} cast · {sc.costumeIds?.length || 0} costume · {sc.propIds?.length || 0}{' '}
                    prop
                  </div>
                </button>
              );
            })
          )}
        </div>

        {scene && (
          <div className="lg:col-span-8 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ns-border)] pb-3">
              <div>
                <div className="font-mono text-[11px] text-[var(--ns-text-subtle)]">
                  Scene #{scene.order} · {scene.id}
                </div>
                <h2 className="font-display text-base font-semibold">{scene.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={aiReviewBusy || !routePreview.executable}
                  onClick={() => void handleAiSceneReview()}
                  title={routePreview.userNotice}
                  className="h-8 px-3 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)] disabled:opacity-45 inline-flex items-center gap-1.5"
                >
                  <Wand2 className="w-3.5 h-3.5 text-[var(--ns-accent)]" />
                  <span>{aiReviewBusy ? 'Reviewing...' : 'AI Review Scene Prep'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => store.setActiveSection('storyboard')}
                  className="h-8 px-3 rounded bg-[var(--ns-accent)] text-white font-medium"
                >
                  Open Storyboard
                </button>
              </div>
            </div>

            {aiReviewNotes && (
              <div className="p-3.5 rounded-md border border-[var(--ns-accent-blue)] bg-[var(--ns-surface-inset)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">AI Scene Preparation Review (Scoped Context Only)</span>
                  <button
                    type="button"
                    onClick={() => setAiReviewNotes(null)}
                    className="text-[11px] text-[var(--ns-text-muted)]"
                  >
                    Close
                  </button>
                </div>
                {aiReviewNotes.raw ? (
                  <p className="whitespace-pre-wrap">{aiReviewNotes.raw}</p>
                ) : (
                  <div className="space-y-1.5 text-[11px]">
                    {aiReviewNotes.missingElements && (
                      <div>
                        <strong>Missing / Check Items:</strong> {aiReviewNotes.missingElements.join(' · ')}
                      </div>
                    )}
                    {aiReviewNotes.suggestedShots && (
                      <div>
                        <strong>Suggested Shots:</strong> {aiReviewNotes.suggestedShots.join(' · ')}
                      </div>
                    )}
                    {aiReviewNotes.lightingNotes && (
                      <div>
                        <strong>Lighting & Atmosphere:</strong> {aiReviewNotes.lightingNotes}
                      </div>
                    )}
                    {aiReviewNotes.promptGuidance && (
                      <div>
                        <strong>Prompt Guidance:</strong> {aiReviewNotes.promptGuidance}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">INT / EXT</label>
                <select
                  value={scene.interiorExterior || 'EXT'}
                  onChange={(e) =>
                    store.updateScene(scene.id, (s) => ({
                      ...s,
                      interiorExterior: e.target.value as InteriorExterior,
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                >
                  <option value="INT">INT</option>
                  <option value="EXT">EXT</option>
                  <option value="INT/EXT">INT/EXT</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Time of Day</label>
                <input
                  type="text"
                  value={scene.timeOfDay || ''}
                  onChange={(e) => store.updateScene(scene.id, (s) => ({ ...s, timeOfDay: e.target.value }))}
                  className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Production Complexity</label>
                <select
                  value={scene.productionComplexity || 'medium'}
                  onChange={(e) =>
                    store.updateScene(scene.id, (s) => ({
                      ...s,
                      productionComplexity: e.target.value as ScenePlan['productionComplexity'],
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Linked Location Bible Entry</label>
                <select
                  value={scene.locationId || ''}
                  onChange={(e) =>
                    store.updateScene(scene.id, (s) => ({
                      ...s,
                      locationId: e.target.value || undefined,
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                >
                  <option value="">Unassigned Location</option>
                  {(project.locations || []).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.interiorExterior || 'EXT'} · {loc.timeOfDay})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Emotional Tone</label>
                <input
                  type="text"
                  value={scene.emotionalTone || ''}
                  onChange={(e) => store.updateScene(scene.id, (s) => ({ ...s, emotionalTone: e.target.value }))}
                  className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Environmental Conditions</label>
                <input
                  type="text"
                  value={scene.environmentalConditions || ''}
                  onChange={(e) =>
                    store.updateScene(scene.id, (s) => ({ ...s, environmentalConditions: e.target.value }))
                  }
                  className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Wardrobe Requirements Summary</label>
                <input
                  type="text"
                  value={scene.wardrobeRequirements || ''}
                  onChange={(e) =>
                    store.updateScene(scene.id, (s) => ({ ...s, wardrobeRequirements: e.target.value }))
                  }
                  className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Actions Summary</label>
                <textarea
                  rows={2}
                  value={scene.actionsSummary || scene.description}
                  onChange={(e) =>
                    store.updateScene(scene.id, (s) => ({ ...s, actionsSummary: e.target.value }))
                  }
                  className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Dialogue / Lyrics Summary</label>
                <textarea
                  rows={2}
                  value={scene.dialogueSummary || ''}
                  onChange={(e) =>
                    store.updateScene(scene.id, (s) => ({ ...s, dialogueSummary: e.target.value }))
                  }
                  className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Visual & Technical Requirements</label>
              <textarea
                rows={2}
                value={scene.visualRequirements || ''}
                onChange={(e) =>
                  store.updateScene(scene.id, (s) => ({ ...s, visualRequirements: e.target.value }))
                }
                className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>

            {/* Linked Characters, Costumes, Props */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--ns-border)]">
              <div className="space-y-1.5">
                <div className="font-medium text-[var(--ns-text-muted)]">Characters in Scene</div>
                {project.characters.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    <input
                      type="checkbox"
                      checked={scene.characterIds.includes(c.id)}
                      onChange={() => toggleSceneListId('characterIds', c.id)}
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="font-medium text-[var(--ns-text-muted)]">Costumes in Scene</div>
                {(project.costumes || []).map((co) => (
                  <label
                    key={co.id}
                    className="flex items-center gap-2 p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    <input
                      type="checkbox"
                      checked={(scene.costumeIds || []).includes(co.id) || co.sceneIds.includes(scene.id)}
                      onChange={() => toggleSceneListId('costumeIds', co.id)}
                    />
                    <span className="truncate">{co.name || co.garmentDescription}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="font-medium text-[var(--ns-text-muted)]">Props in Scene</div>
                {(project.props || []).map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    <input
                      type="checkbox"
                      checked={(scene.propIds || []).includes(p.id) || p.sceneIds.includes(scene.id)}
                      onChange={() => toggleSceneListId('propIds', p.id)}
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {scene.sourceScreenplayPassage && (
              <div className="p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-[11px] text-[var(--ns-text-muted)] flex items-start gap-2">
                <Link2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>Source Passage (Screenplay v{scene.sourceScreenplayVersion || 1}):</strong>{' '}
                  {scene.sourceScreenplayPassage}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
