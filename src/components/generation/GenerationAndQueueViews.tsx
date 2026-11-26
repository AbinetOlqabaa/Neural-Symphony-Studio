import { useState } from 'react';
import { Check, Film, Play, Plus, RefreshCw, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import {
  ENGINE_REGISTRY,
  snapDimensionToMultiple,
  snapLtxFrameCount,
  snapWanFrameCount,
  validateGenerationParams,
} from '../../modules/generation-engine/engineRules';
import type {
  ClipApprovalState,
  EngineId,
  GenerationParameters,
  JobStatus,
  QualityChecklist,
  VideoClip,
} from '../../types/studio';
import { MediaThumb } from '../shared/MediaThumb';

const CHECKLIST_LABELS: Array<{ key: keyof QualityChecklist; label: string }> = [
  { key: 'characterConsistency', label: 'Character Consistency' },
  { key: 'facialConsistency', label: 'Facial Consistency' },
  { key: 'compositionPreservation', label: 'Composition Preservation' },
  { key: 'clothingConsistency', label: 'Clothing Consistency' },
  { key: 'backgroundStability', label: 'Background Stability' },
  { key: 'anatomicalIntegrity', label: 'Anatomical Integrity' },
  { key: 'flickerFree', label: 'Flicker-Free Motion' },
  { key: 'naturalMotion', label: 'Natural Motion' },
  { key: 'noCorruption', label: 'No Video Corruption' },
];

export function GenerationStudioView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  const [selectedClipId, setSelectedClipId] = useState<string>('');
  const [compareSplit, setCompareSplit] = useState(50);
  const [frameIndex, setFrameIndex] = useState(0);

  const scene = project?.scenes.find((s) => s.id === selectedSceneId) || project?.scenes[0];
  const [params, setParams] = useState<GenerationParameters>(
    scene?.generationSettings || ENGINE_REGISTRY['ltx-video'].defaultParams
  );

  if (!project) return null;

  const sceneClips = scene ? project.clips.filter((c) => c.sceneId === scene.id) : [];
  const activeClip: VideoClip | undefined =
    sceneClips.find((c) => c.id === selectedClipId) || sceneClips[0] || project.clips[0];

  const refAsset = scene?.referenceAssetIds[0]
    ? project.mediaAssets.find((a) => a.id === scene.referenceAssetIds[0])
    : project.mediaAssets[0];

  const validation = validateGenerationParams(params);
  const activeEngineDef = ENGINE_REGISTRY[params.engine];
  const engineCap =
    params.engine === 'ltx-video'
      ? store.ltxCapability
      : params.engine === 'wan-2.1'
      ? store.wanCapability
      : null;

  const activeLiveJob = scene
    ? project.jobs.find(
        (j) =>
          j.sceneId === scene.id &&
          j.mode === 'comfyui_live' &&
          (j.status === 'submitting' || j.status === 'queued' || j.status === 'running')
      )
    : undefined;

  const handleEngineSwitch = (nextEngine: EngineId) => {
    setParams({ ...ENGINE_REGISTRY[nextEngine].defaultParams });
  };

  const handleSubmit = async (mode: 'comfyui_live' | 'offline_simulation') => {
    if (!scene) return;
    await store.submitGenerationJob({
      sceneId: scene.id,
      params,
      positivePrompt: scene.positivePrompt || scene.description,
      negativePrompt: scene.negativePrompt || 'blurry, inconsistent identity',
      mode,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Generation Studio & Quality Review</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Configure modular engine parameters, submit ComfyUI workflows or offline test clips, and audit quality before timeline assembly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Select scene to generate"
            value={scene?.id || ''}
            onChange={(e) => {
              const nextScene = project.scenes.find((s) => s.id === e.target.value);
              setSelectedSceneId(e.target.value);
              if (nextScene) setParams({ ...nextScene.generationSettings });
            }}
            className="h-9 px-3 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          >
            {project.scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!scene ? (
        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-8 text-center text-xs text-[var(--ns-text-muted)]">
          Create a scene in Scene Planner first.
        </div>
      ) : (
        <>
          {/* 3-Panel Studio Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* LEFT PANEL: Context & Prompts */}
            <section className="xl:col-span-3 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-4 text-xs">
              <h2 className="font-display text-sm font-semibold">Scene Context</h2>

              <div>
                <div className="text-[var(--ns-text-muted)] mb-1.5">Reference Frame</div>
                <MediaThumb
                  src={refAsset?.thumbnailUrl}
                  alt={refAsset?.fileName || 'Reference'}
                  className="rounded border border-[var(--ns-border)]"
                  aspectClass="aspect-video"
                />
              </div>

              <div>
                <div className="text-[var(--ns-text-muted)]">Assigned Characters</div>
                <div className="mt-1 font-medium">
                  {scene.characterIds.length > 0
                    ? project.characters
                        .filter((c) => scene.characterIds.includes(c.id))
                        .map((c) => c.name)
                        .join(', ')
                    : 'No character linked'}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Positive Prompt</label>
                <textarea
                  rows={4}
                  value={scene.positivePrompt}
                  onChange={(e) => store.updateScene(scene.id, (s) => ({ ...s, positivePrompt: e.target.value }))}
                  className="w-full p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Negative Prompt</label>
                <textarea
                  rows={2}
                  value={scene.negativePrompt}
                  onChange={(e) => store.updateScene(scene.id, (s) => ({ ...s, negativePrompt: e.target.value }))}
                  className="w-full p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-xs"
                />
              </div>
            </section>

            {/* CENTER PANEL: Preview, Before/After Compare & Quality Control */}
            <section className="xl:col-span-6 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm font-semibold">
                    {activeClip ? `Clip v${activeClip.versionNumber} Preview` : 'Reference Preview'}
                  </h2>
                  {activeClip && (
                    <div className="text-[11px] text-[var(--ns-text-subtle)] tabular-nums">
                      {activeClip.mode === 'offline_simulation' ? 'OFFLINE SIMULATION CLIP' : 'REAL BACKEND CLIP'} ·{' '}
                      {activeClip.width}x{activeClip.height} · {activeClip.fps}fps · Seed {activeClip.seed}
                    </div>
                  )}
                </div>

                {activeClip && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => store.addClipToTimeline(activeClip)}
                      className="h-8 px-3 rounded border border-[var(--ns-border)] text-xs font-medium inline-flex items-center gap-1 hover:bg-[var(--ns-surface-elevated)]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Timeline</span>
                    </button>
                  </div>
                )}
              </div>

              {activeLiveJob && (
                <div className="p-3 rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-accent)]/50 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--ns-text)]">
                      REAL BACKEND JOB · {activeLiveJob.status.toUpperCase()}
                      {activeLiveJob.currentNode ? ` (Node ${activeLiveJob.currentNode})` : ''}
                    </span>
                    <span className="font-mono tabular-nums">{activeLiveJob.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded bg-[var(--ns-border)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--ns-accent)] transition-all duration-200"
                      style={{ width: `${activeLiveJob.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Comparison Viewport */}
              <div className="relative rounded-md overflow-hidden border border-[var(--ns-border)] bg-black aspect-video select-none">
                {activeClip?.previewVideoUrl ? (
                  <video src={activeClip.previewVideoUrl} controls className="w-full h-full object-contain" />
                ) : (
                  <>
                    <img
                      src={
                        activeClip?.extractedFrames[frameIndex] ||
                        activeClip?.thumbnailUrl ||
                        refAsset?.dataUrl ||
                        ''
                      }
                      alt="Generated output preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {refAsset && activeClip && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}
                      >
                        <img
                          src={refAsset.dataUrl}
                          alt="Original reference"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {refAsset && activeClip && (
                      <div
                        className="absolute inset-y-0 w-0.5 bg-white/85 pointer-events-none"
                        style={{ left: `${compareSplit}%` }}
                      />
                    )}
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/75 text-[11px] text-white">
                      Reference ({compareSplit}%)
                    </div>
                    <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/75 text-[11px] text-white">
                      {activeClip ? `Clip v${activeClip.versionNumber}` : 'No clip yet'}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="compare-split-range" className="block text-[var(--ns-text-muted)] mb-1">
                    Before / After Split ({compareSplit}%)
                  </label>
                  <input
                    id="compare-split-range"
                    type="range"
                    min={0}
                    max={100}
                    value={compareSplit}
                    onChange={(e) => setCompareSplit(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                {activeClip && activeClip.extractedFrames.length > 0 && (
                  <div>
                    <label htmlFor="frame-scrub-range" className="block text-[var(--ns-text-muted)] mb-1">
                      Extracted Keyframe Inspection (Frame {frameIndex + 1} / {activeClip.extractedFrames.length})
                    </label>
                    <input
                      id="frame-scrub-range"
                      type="range"
                      min={0}
                      max={Math.max(0, activeClip.extractedFrames.length - 1)}
                      value={frameIndex}
                      onChange={(e) => setFrameIndex(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* 3-Tier Quality & Identity Control */}
              {activeClip && (
                <div className="pt-3 border-t border-[var(--ns-border)] space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[var(--ns-accent-blue)]" />
                      <span>Manual Quality & Identity Review</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          ['technically_generated', 'Technically Generated'],
                          ['visually_acceptable', 'Visually Acceptable'],
                          ['production_approved', 'Production Approved'],
                          ['rejected', 'Rejected'],
                        ] as Array<[ClipApprovalState, string]>
                      ).map(([state, label]) => (
                        <button
                          key={state}
                          type="button"
                          onClick={() => store.updateClipQuality(activeClip.id, { approvalState: state })}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium border ${
                            activeClip.approvalState === state
                              ? state === 'production_approved'
                                ? 'border-[var(--ns-success)] bg-[var(--ns-success)]/15 text-[var(--ns-success)]'
                                : state === 'rejected'
                                ? 'border-[var(--ns-danger)] bg-[var(--ns-danger)]/15 text-[var(--ns-danger)]'
                                : 'border-[var(--ns-accent)] bg-[var(--ns-accent)]/15 text-[var(--ns-text)]'
                              : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {CHECKLIST_LABELS.map(({ key, label }) => {
                      const val = activeClip.qualityChecklist[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            const nextVal = val === 'unreviewed' ? 'pass' : val === 'pass' ? 'issue' : 'unreviewed';
                            store.updateClipQuality(activeClip.id, {
                              qualityChecklist: { ...activeClip.qualityChecklist, [key]: nextVal },
                            });
                          }}
                          className="p-2 rounded border border-[var(--ns-border)] bg-[var(--ns-surface-inset)] flex items-center justify-between text-left"
                        >
                          <span className="truncate pr-1">{label}</span>
                          <span
                            className={
                              val === 'pass'
                                ? 'text-[var(--ns-success)]'
                                : val === 'issue'
                                ? 'text-[var(--ns-danger)]'
                                : 'text-[var(--ns-text-subtle)]'
                            }
                          >
                            {val === 'pass' ? <Check className="w-3.5 h-3.5" /> : val === 'issue' ? <XCircle className="w-3.5 h-3.5" /> : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* RIGHT PANEL: Engine Parameters & Submit */}
            <section className="xl:col-span-3 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold">Engine Configuration</h2>
                <span
                  className={
                    store.comfyStats?.connected
                      ? 'text-[11px] text-[var(--ns-success)]'
                      : 'text-[11px] text-[var(--ns-warning)]'
                  }
                >
                  {store.comfyStats?.connected ? 'GPU Connected' : 'GPU Offline'}
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Generation Engine</label>
                <select
                  value={params.engine}
                  onChange={(e) => handleEngineSwitch(e.target.value as EngineId)}
                  className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                >
                  {Object.values(ENGINE_REGISTRY).map((eng) => (
                    <option key={eng.id} value={eng.id}>
                      {eng.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[var(--ns-text-subtle)]">{activeEngineDef.targetModel}</p>
              </div>

              {store.comfyStats?.connected && engineCap && !engineCap.ready && (
                <div className="p-2.5 rounded bg-[var(--ns-warning)]/10 border border-[var(--ns-warning)]/60 text-[11px] text-[var(--ns-warning)] space-y-1">
                  <div className="font-medium">Backend Adapter Notice</div>
                  {engineCap.missingNodes.length > 0 && (
                    <div>Missing nodes: {engineCap.missingNodes.join(', ')}</div>
                  )}
                  {engineCap.missingModels.length > 0 && (
                    <div>Missing models: {engineCap.missingModels.join(', ')}</div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Width (px)</label>
                  <input
                    type="number"
                    step={activeEngineDef.dimensionMultiple}
                    value={params.width}
                    onChange={(e) =>
                      setParams((p) => ({
                        ...p,
                        width: snapDimensionToMultiple(
                          Number(e.target.value) || p.width,
                          activeEngineDef.dimensionMultiple,
                          activeEngineDef.minWidth,
                          activeEngineDef.maxWidth
                        ),
                      }))
                    }
                    className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Height (px)</label>
                  <input
                    type="number"
                    step={activeEngineDef.dimensionMultiple}
                    value={params.height}
                    onChange={(e) =>
                      setParams((p) => ({
                        ...p,
                        height: snapDimensionToMultiple(
                          Number(e.target.value) || p.height,
                          activeEngineDef.dimensionMultiple,
                          activeEngineDef.minHeight,
                          activeEngineDef.maxHeight
                        ),
                      }))
                    }
                    className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">
                    Frames ({activeEngineDef.frameRule})
                  </label>
                  <input
                    type="number"
                    value={params.frameCount}
                    onChange={(e) => {
                      const raw = Number(e.target.value) || activeEngineDef.minFrames;
                      const snapped =
                        params.engine === 'ltx-video'
                          ? snapLtxFrameCount(raw)
                          : params.engine === 'wan-2.1'
                          ? snapWanFrameCount(raw)
                          : raw;
                      setParams((p) => ({ ...p, frameCount: snapped }));
                    }}
                    className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">FPS</label>
                  <input
                    type="number"
                    value={params.fps}
                    onChange={(e) => setParams((p) => ({ ...p, fps: Number(e.target.value) || 24 }))}
                    className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Steps</label>
                  <input
                    type="number"
                    value={params.steps}
                    onChange={(e) => setParams((p) => ({ ...p, steps: Number(e.target.value) || 25 }))}
                    className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Guidance (CFG)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={params.guidanceScale}
                    onChange={(e) => setParams((p) => ({ ...p, guidanceScale: Number(e.target.value) || 3.5 }))}
                    className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[var(--ns-text-muted)]">Seed</label>
                  <button
                    type="button"
                    onClick={() => setParams((p) => ({ ...p, seed: Math.floor(Math.random() * 999999) }))}
                    className="text-[11px] text-[var(--ns-accent-blue)] hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Randomize</span>
                  </button>
                </div>
                <input
                  type="number"
                  value={params.seed}
                  onChange={(e) => setParams((p) => ({ ...p, seed: Number(e.target.value) || 0 }))}
                  className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
                />
              </div>

              {!validation.valid && (
                <div className="p-2.5 rounded bg-[var(--ns-danger)]/10 border border-[var(--ns-danger)] text-[11px] text-[var(--ns-danger)]">
                  {validation.errors[0]}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={!validation.valid}
                  onClick={() => void handleSubmit('comfyui_live')}
                  className="w-full h-9 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] disabled:opacity-40 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Generate via ComfyUI (Real Backend)</span>
                </button>

                <button
                  type="button"
                  disabled={!validation.valid}
                  onClick={() => void handleSubmit('offline_simulation')}
                  className="w-full h-9 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface-elevated)] hover:border-[var(--ns-border-strong)] text-xs font-medium inline-flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Offline Simulation Test</span>
                </button>
              </div>
            </section>
          </div>

          {/* BOTTOM: Clip Versions */}
          <section className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold">
                Generated Clip Versions ({sceneClips.length} for {scene.title})
              </h2>
              <button
                type="button"
                onClick={() => store.setActiveSection('queue')}
                className="text-xs text-[var(--ns-accent-blue)] hover:underline"
              >
                Open Full Job Queue
              </button>
            </div>

            {sceneClips.length === 0 ? (
              <p className="text-xs text-[var(--ns-text-muted)]">
                No clips generated for this scene yet. All generated versions are preserved automatically.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {sceneClips.map((clip) => (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={() => setSelectedClipId(clip.id)}
                    className={`text-left border rounded-md overflow-hidden transition-colors ${
                      activeClip?.id === clip.id
                        ? 'border-[var(--ns-accent)] bg-[var(--ns-surface-elevated)]'
                        : 'border-[var(--ns-border)] bg-[var(--ns-surface-inset)]'
                    }`}
                  >
                    <MediaThumb src={clip.thumbnailUrl} alt={`Version ${clip.versionNumber}`} aspectClass="aspect-video" />
                    <div className="p-2.5 text-xs space-y-0.5">
                      <div className="flex items-center justify-between font-medium">
                        <span>Version {clip.versionNumber}</span>
                        <span className="font-mono text-[11px] text-[var(--ns-text-subtle)]">{clip.seed}</span>
                      </div>
                      <div className="text-[11px] text-[var(--ns-text-muted)] truncate">
                        {clip.approvalState.replace('_', ' ')} ·{' '}
                        {clip.mode === 'offline_simulation' ? 'Simulation' : 'ComfyUI Live'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const QUEUE_STATUS_FILTERS: Array<'all' | JobStatus> = [
  'all',
  'queued',
  'running',
  'completed',
  'failed',
  'interrupted',
  'cancelled',
];

export function JobQueueView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all');
  const [inspectJobId, setInspectJobId] = useState<string | null>(null);

  if (!project) return null;

  const jobs = project.jobs.filter((j) => (statusFilter === 'all' ? true : j.status === statusFilter));
  const inspected = project.jobs.find((j) => j.id === inspectJobId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Generation Job Queue</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Inspect live ComfyUI jobs, offline simulation tests, active execution nodes, errors, and compiled workflow payloads.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 p-1 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-md">
          {QUEUE_STATUS_FILTERS.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                statusFilter === st ? 'bg-[var(--ns-accent)] text-white' : 'text-[var(--ns-text-muted)]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--ns-border)] text-[var(--ns-text-subtle)] bg-[var(--ns-surface-inset)]">
                <th className="py-2.5 px-4 font-medium">Job ID</th>
                <th className="py-2.5 px-4 font-medium">Scene</th>
                <th className="py-2.5 px-4 font-medium">Execution Mode & Engine</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 text-right font-medium">Progress</th>
                <th className="py-2.5 px-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ns-border)]">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--ns-text-muted)]">
                    No jobs match this filter.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const scene = project.scenes.find((s) => s.id === job.sceneId);
                  const canCancel =
                    job.status === 'pending' ||
                    job.status === 'submitting' ||
                    job.status === 'queued' ||
                    job.status === 'running';
                  const canRetry =
                    job.status === 'failed' || job.status === 'interrupted' || job.status === 'cancelled';

                  return (
                    <tr key={job.id} className="h-12">
                      <td className="py-2 px-4">
                        <div className="font-mono">{job.id}</div>
                        {job.comfyPromptId && (
                          <div className="text-[11px] font-mono text-[var(--ns-text-subtle)] truncate max-w-[160px]">
                            prompt: {job.comfyPromptId}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-4">{scene?.title || job.sceneId}</td>
                      <td className="py-2 px-4">
                        <div className="font-medium">
                          {job.mode === 'offline_simulation' ? 'OFFLINE SIMULATION JOB' : 'REAL BACKEND JOB'}
                        </div>
                        <div className="text-[11px] text-[var(--ns-text-muted)]">
                          {job.engine} · {job.modelName}
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <span
                          className={
                            job.status === 'completed'
                              ? 'text-[var(--ns-success)]'
                              : job.status === 'failed'
                              ? 'text-[var(--ns-danger)]'
                              : 'text-[var(--ns-warning)]'
                          }
                        >
                          {job.status}
                        </span>
                        {job.currentNode && job.status === 'running' && (
                          <div className="text-[11px] text-[var(--ns-text-subtle)]">Node {job.currentNode}</div>
                        )}
                        {job.errorMessage && (
                          <div className="text-[11px] text-[var(--ns-danger)] max-w-[260px] truncate" title={job.errorMessage}>
                            {job.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right font-mono tabular-nums">{job.progress}%</td>
                      <td className="py-2 px-4 text-right space-x-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setInspectJobId(job.id === inspectJobId ? null : job.id)}
                          className="text-[var(--ns-accent-blue)] hover:underline"
                        >
                          {job.id === inspectJobId ? 'Hide JSON' : 'Inspect'}
                        </button>
                        {canRetry && (
                          <button
                            type="button"
                            onClick={() => void store.retryJob(job.id)}
                            className="text-[var(--ns-text)] hover:underline inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => void store.cancelJob(job.id)}
                            className="text-[var(--ns-danger)] hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {inspected && (
        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span>Compiled Job Payload ({inspected.id})</span>
            <button type="button" onClick={() => setInspectJobId(null)} className="text-[var(--ns-text-muted)]">
              Close
            </button>
          </div>
          <pre className="p-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-xs font-mono overflow-x-auto max-h-72">
            {JSON.stringify(inspected, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
