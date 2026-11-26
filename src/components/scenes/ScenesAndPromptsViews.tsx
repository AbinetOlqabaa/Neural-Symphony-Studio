import { useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import { ENGINE_REGISTRY } from '../../modules/generation-engine/engineRules';
import { compileStructuredPrompt, estimatePromptTokens } from '../../modules/prompt-engineering/promptCompiler';
import type { EngineId, ImageAnalysis } from '../../types/studio';
import { MediaThumb } from '../shared/MediaThumb';

export function ScenePlannerView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  const [aiPlanning, setAiPlanning] = useState(false);

  if (!project) return null;

  const sortedScenes = project.scenes.slice().sort((a, b) => a.order - b.order);
  const selected = sortedScenes.find((s) => s.id === selectedSceneId) || sortedScenes[0];

  const handleGenerateAiPlan = async () => {
    setAiPlanning(true);
    try {
      await store.generateAiScenesForProject();
    } catch (err) {
      store.notify('error', err instanceof Error ? err.message : 'AI scene planning failed');
    } finally {
      setAiPlanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Scene Planner & Storyboard</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Sequence scenes, link Character Bible identities and multiple reference images, and approve plans before generation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={aiPlanning}
            onClick={() => void handleGenerateAiPlan()}
            className="h-9 px-3.5 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] hover:bg-[var(--ns-surface-elevated)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--ns-accent)]" />
            <span>{aiPlanning ? 'Planning...' : 'AI Suggest Scenes'}</span>
          </button>
          <button
            type="button"
            onClick={() => store.addScene()}
            className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Scene</span>
          </button>
        </div>
      </div>

      {/* Storyboard Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sortedScenes.map((scene, index) => {
          const primaryAsset = project.mediaAssets.find((a) => a.id === scene.referenceAssetIds[0]);
          const isSelected = selected?.id === scene.id;
          return (
            <div
              key={scene.id}
              className={`bg-[var(--ns-surface)] border rounded-lg overflow-hidden transition-colors ${
                isSelected ? 'border-[var(--ns-accent)]' : 'border-[var(--ns-border)]'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedSceneId(scene.id)}
                className="w-full text-left"
              >
                <MediaThumb src={primaryAsset?.thumbnailUrl} alt={scene.title} aspectClass="aspect-video" />
                <div className="p-3 space-y-1">
                  <div className="text-xs font-semibold truncate">{scene.title}</div>
                  <div className="text-[11px] text-[var(--ns-text-subtle)] tabular-nums">
                    {scene.durationSeconds}s · {scene.cameraFraming} ·{' '}
                    <span className={scene.approvedForGeneration ? 'text-[var(--ns-success)]' : 'text-[var(--ns-warning)]'}>
                      {scene.approvedForGeneration ? 'Approved' : 'Draft'}
                    </span>
                  </div>
                </div>
              </button>
              <div className="px-3 pb-2.5 flex items-center justify-between border-t border-[var(--ns-border)] pt-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={`Move ${scene.title} up`}
                    onClick={() => store.reorderScene(scene.id, 'up')}
                    className="p-1 rounded border border-[var(--ns-border)] disabled:opacity-30"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={index === sortedScenes.length - 1}
                    aria-label={`Move ${scene.title} down`}
                    onClick={() => store.reorderScene(scene.id, 'down')}
                    className="p-1 rounded border border-[var(--ns-border)] disabled:opacity-30"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${scene.title}`}
                  onClick={() =>
                    store.updateActiveProject((proj) => ({
                      ...proj,
                      scenes: proj.scenes
                        .filter((s) => s.id !== scene.id)
                        .map((s, idx) => ({ ...s, order: idx + 1 })),
                    }))
                  }
                  className="p-1 rounded text-[var(--ns-text-subtle)] hover:text-[var(--ns-danger)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scene Detail Editor */}
      {selected && (
        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ns-border)] pb-3">
            <div>
              <div className="text-xs font-mono text-[var(--ns-text-subtle)]">
                Scene #{selected.order} · {selected.id}
              </div>
              <h2 className="font-display text-lg font-semibold">{selected.title}</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  store.updateScene(selected.id, (s) => ({
                    ...s,
                    approvedForGeneration: !s.approvedForGeneration,
                    status: !s.approvedForGeneration ? 'prompt_ready' : 'planned',
                  }))
                }
                className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 border ${
                  selected.approvedForGeneration
                    ? 'border-[var(--ns-success)] text-[var(--ns-success)] bg-[var(--ns-success)]/10'
                    : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{selected.approvedForGeneration ? 'Approved for Generation' : 'Approve Scene Plan'}</span>
              </button>
              <button
                type="button"
                onClick={() => store.setActiveSection('prompts')}
                className="h-8 px-3 rounded-md bg-[var(--ns-accent)] text-white text-xs font-medium"
              >
                Open in Prompt Studio
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Scene Title</label>
              <input
                type="text"
                value={selected.title}
                onChange={(e) => store.updateScene(selected.id, (s) => ({ ...s, title: e.target.value }))}
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Camera Framing</label>
                <input
                  type="text"
                  value={selected.cameraFraming}
                  onChange={(e) => store.updateScene(selected.id, (s) => ({ ...s, cameraFraming: e.target.value }))}
                  className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Duration (sec)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={selected.durationSeconds}
                  onChange={(e) =>
                    store.updateScene(selected.id, (s) => ({ ...s, durationSeconds: Number(e.target.value) || 4 }))
                  }
                  className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] tabular-nums"
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Cinematic Scene Description</label>
              <textarea
                rows={2}
                value={selected.description}
                onChange={(e) => store.updateScene(selected.id, (s) => ({ ...s, description: e.target.value }))}
                className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>

            {(
              [
                ['environmentDescription', 'Environment'],
                ['composition', 'Composition'],
                ['lighting', 'Lighting'],
                ['cameraMovement', 'Camera Movement'],
                ['motionDirection', 'Motion Direction'],
                ['narrativePurpose', 'Narrative Purpose'],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">{label}</label>
                <input
                  type="text"
                  value={selected[field]}
                  onChange={(e) => store.updateScene(selected.id, (s) => ({ ...s, [field]: e.target.value }))}
                  className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>
            ))}
          </div>

          {/* Multi-Reference Images & Characters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[var(--ns-border)] text-xs">
            <div className="space-y-2">
              <div className="font-medium text-[var(--ns-text-muted)]">Reference Images (Multi-select)</div>
              <div className="flex flex-wrap gap-2">
                {project.mediaAssets.map((asset) => {
                  const linked = selected.referenceAssetIds.includes(asset.id);
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() =>
                        store.updateScene(selected.id, (s) => ({
                          ...s,
                          referenceAssetIds: linked
                            ? s.referenceAssetIds.filter((id) => id !== asset.id)
                            : [...s.referenceAssetIds, asset.id],
                        }))
                      }
                      className={`px-2.5 py-1.5 rounded border text-xs ${
                        linked
                          ? 'border-[var(--ns-accent)] bg-[var(--ns-accent)]/15 text-[var(--ns-text)]'
                          : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                      }`}
                    >
                      {asset.fileName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-[var(--ns-text-muted)]">Assigned Characters</div>
              <div className="flex flex-wrap gap-2">
                {project.characters.map((char) => {
                  const linked = selected.characterIds.includes(char.id);
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() =>
                        store.updateScene(selected.id, (s) => ({
                          ...s,
                          characterIds: linked
                            ? s.characterIds.filter((id) => id !== char.id)
                            : [...s.characterIds, char.id],
                        }))
                      }
                      className={`px-2.5 py-1.5 rounded border text-xs ${
                        linked
                          ? 'border-[var(--ns-accent)] bg-[var(--ns-accent)]/15 text-[var(--ns-text)]'
                          : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                      }`}
                    >
                      {char.name} ({char.label})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PROMPT_TEMPLATES = [
  {
    name: 'Nocturnal 35mm Performance',
    style: '35mm anamorphic cinema, shallow depth of field, warm practical streetlamp rim lighting, film grain',
  },
  {
    name: 'Blue-Hour Atmospheric Crane',
    style: 'Wide architectural twilight aesthetic, misty air depth, restrained slate-blue shadows, steady crane sweep',
  },
  {
    name: 'Studio Tactile Macro',
    style: 'Warm tungsten desk lamp key light, brushed analog hardware texture, deliberate rack focus',
  },
];

export function PromptStudioView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  const [engine, setEngine] = useState<EngineId>('ltx-video');
  const [userNotes, setUserNotes] = useState('');
  const [positiveDraft, setPositiveDraft] = useState<string | null>(null);
  const [negativeDraft, setNegativeDraft] = useState<string | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);

  if (!project) return null;

  const scene = project.scenes.find((s) => s.id === selectedSceneId) || project.scenes[0];
  const analyses = scene
    ? scene.referenceAssetIds.map((id) => project.analyses[id]).filter((a): a is ImageAnalysis => Boolean(a))
    : [];

  const compiled = scene
    ? compileStructuredPrompt({
        scene,
        characters: project.characters,
        analyses,
        engine,
      })
    : null;

  const activePositive = positiveDraft ?? scene?.positivePrompt ?? compiled?.positivePrompt ?? '';
  const activeNegative = negativeDraft ?? scene?.negativePrompt ?? compiled?.negativePrompt ?? '';
  const tokenCount = estimatePromptTokens(activePositive) + estimatePromptTokens(activeNegative);

  const history = scene
    ? project.promptHistory.filter((p) => p.sceneId === scene.id && p.engine === engine)
    : [];

  const handleCompileAndSave = async (useAi: boolean) => {
    if (!scene) return;
    setSynthesizing(useAi);
    try {
      const saved = await store.compileAndSavePrompt(scene.id, engine, {
        useAi,
        userNotes,
        overridePositive: useAi ? undefined : positiveDraft ?? compiled?.positivePrompt,
        overrideNegative: useAi ? undefined : negativeDraft ?? compiled?.negativePrompt,
      });
      if (saved) {
        setPositiveDraft(saved.positivePrompt);
        setNegativeDraft(saved.negativePrompt);
      }
    } catch (err) {
      store.notify('error', err instanceof Error ? err.message : 'Prompt compilation failed');
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold">Prompt Studio</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Compile engine-adapted positive/negative prompts from Image Intelligence, Character Bible, and Scene Plans.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Target scene"
            value={scene?.id || ''}
            onChange={(e) => {
              setSelectedSceneId(e.target.value);
              setPositiveDraft(null);
              setNegativeDraft(null);
            }}
            className="h-9 px-3 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          >
            {project.scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          <select
            aria-label="Target generation engine"
            value={engine}
            onChange={(e) => {
              setEngine(e.target.value as EngineId);
              setPositiveDraft(null);
              setNegativeDraft(null);
            }}
            className="h-9 px-3 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          >
            {Object.values(ENGINE_REGISTRY).map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.name} ({eng.targetModel})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!scene ? (
        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-8 text-center text-xs text-[var(--ns-text-muted)]">
          Create a scene in Scene Planner first to engineer prompts.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Prompt Editor */}
          <div className="lg:col-span-8 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-[var(--ns-text-muted)]">
                Adapted for <span className="text-[var(--ns-text)] font-medium">{ENGINE_REGISTRY[engine].name}</span> ·{' '}
                <span className="font-mono tabular-nums">~{tokenCount} tokens</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!compiled) return;
                    setPositiveDraft(compiled.positivePrompt);
                    setNegativeDraft(compiled.negativePrompt);
                  }}
                  className="h-8 px-3 rounded border border-[var(--ns-border)] text-xs hover:bg-[var(--ns-surface-elevated)]"
                >
                  Auto-Build from Bible
                </button>
                <button
                  type="button"
                  disabled={synthesizing}
                  onClick={() => void handleCompileAndSave(true)}
                  className="h-8 px-3 rounded border border-[var(--ns-border)] text-xs inline-flex items-center gap-1 hover:bg-[var(--ns-surface-elevated)]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--ns-accent)]" />
                  <span>{synthesizing ? 'Adapting...' : 'AI Adapt Prompt'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCompileAndSave(false)}
                  className="h-8 px-3.5 rounded bg-[var(--ns-accent)] text-white text-xs font-medium"
                >
                  Save New Version
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="positive-prompt-box" className="block text-xs font-medium text-[var(--ns-text-muted)]">
                Positive Prompt
              </label>
              <textarea
                id="positive-prompt-box"
                rows={4}
                value={activePositive}
                onChange={(e) => setPositiveDraft(e.target.value)}
                className="w-full p-3 text-sm rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="negative-prompt-box" className="block text-xs font-medium text-[var(--ns-text-muted)]">
                Negative Prompt
              </label>
              <textarea
                id="negative-prompt-box"
                rows={2}
                value={activeNegative}
                onChange={(e) => setNegativeDraft(e.target.value)}
                className="w-full p-3 text-sm rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prompt-director-notes" className="block text-xs font-medium text-[var(--ns-text-muted)]">
                Director Instructions / Version Note
              </label>
              <input
                id="prompt-director-notes"
                type="text"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="e.g., Slow down camera push-in, emphasize silver earrings"
                className="w-full h-9 px-3 text-xs rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>

            {compiled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[var(--ns-border)] text-xs">
                <div className="p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]">
                  <div className="text-[11px] text-[var(--ns-text-subtle)]">Character Consistency</div>
                  <div className="mt-1">{compiled.characterConsistencyBlock || 'No character assigned'}</div>
                </div>
                <div className="p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]">
                  <div className="text-[11px] text-[var(--ns-text-subtle)]">Camera & Motion</div>
                  <div className="mt-1">
                    {compiled.cameraMovementBlock} · {compiled.motionBlock}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Templates & Version History */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-2.5">
              <h2 className="font-display text-sm font-semibold">Style Prompt Templates</h2>
              <div className="space-y-2">
                {PROMPT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => {
                      setPositiveDraft(`${activePositive.trim()} ${tpl.style}`.trim());
                    }}
                    className="w-full text-left p-2.5 rounded border border-[var(--ns-border)] hover:border-[var(--ns-border-strong)] bg-[var(--ns-surface-inset)] text-xs"
                  >
                    <div className="font-medium">{tpl.name}</div>
                    <div className="text-[11px] text-[var(--ns-text-subtle)] mt-0.5 line-clamp-2">{tpl.style}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-2.5">
              <h2 className="font-display text-sm font-semibold">
                Version History ({ENGINE_REGISTRY[engine].name})
              </h2>
              {history.length === 0 ? (
                <p className="text-xs text-[var(--ns-text-muted)]">
                  No saved versions for this scene and engine yet. Click Save New Version to record v1.
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {history.map((pv) => (
                    <div
                      key={pv.id}
                      className="p-2.5 rounded border border-[var(--ns-border)] bg-[var(--ns-surface-inset)] text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium">v{pv.version}</span>
                        <span className="text-[11px] text-[var(--ns-text-subtle)] tabular-nums">
                          ~{pv.estimatedTokens} tok
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--ns-text-muted)] line-clamp-2">{pv.positivePrompt}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setPositiveDraft(pv.positivePrompt);
                          setNegativeDraft(pv.negativePrompt);
                        }}
                        className="text-[11px] text-[var(--ns-accent-blue)] hover:underline"
                      >
                        Restore to Editor
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
