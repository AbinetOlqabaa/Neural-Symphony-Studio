import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  CheckCircle2,
  Download,
  Film,
  Plus,
  Printer,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import { renderStoryboardMarkdown } from '../../modules/production/documentSystem';
import {
  STANDARD_CAMERA_ANGLES,
  STANDARD_CAMERA_MOVEMENTS,
  STANDARD_SHOT_SIZES,
  exportShotListAsCsv,
  exportShotListAsJson,
  exportShotListAsMarkdown,
  exportShotListAsPrintableHtml,
  exportStoryboardContactSheetHtml,
} from '../../modules/production/preProductionEngine';
import type {
  ShotPriority,
  ShotSpec,
  StoryboardFrameSpec,
  StoryboardMode,
} from '../../types/studio';
import { MediaThumb } from '../shared/MediaThumb';

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function StoryboardStudioView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [filterSceneId, setFilterSceneId] = useState<string>('all');
  const [selectedFrameId, setSelectedFrameId] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!project) return null;

  const sceneOrderMap = new Map(project.scenes.map((sc, idx) => [sc.id, sc.order ?? idx + 1]));
  const frames = (project.storyboardFrames || [])
    .filter((f) => (filterSceneId === 'all' ? true : f.sceneId === filterSceneId))
    .slice()
    .sort((a, b) => {
      const ordA = sceneOrderMap.get(a.sceneId) ?? 999;
      const ordB = sceneOrderMap.get(b.sceneId) ?? 999;
      if (ordA !== ordB) return ordA - ordB;
      return (a.frameNumber ?? 0) - (b.frameNumber ?? 0);
    });

  const selected = frames.find((f) => f.id === selectedFrameId) || frames[0];
  const imageRoute = store.resolveTaskPreview('storyboard_image_creation');

  const handleAddFrame = () => {
    const targetSceneId =
      filterSceneId !== 'all' ? filterSceneId : project.scenes[0]?.id || 'unassigned';
    const existingCount = (project.storyboardFrames || []).filter(
      (f) => f.sceneId === targetSceneId
    ).length;
    const nextNum = existingCount + 1;
    const sceneObj = project.scenes.find((s) => s.id === targetSceneId);
    const id = `sb_${Date.now().toString(36)}`;
    const newFrame: StoryboardFrameSpec = {
      id,
      sceneId: targetSceneId,
      frameNumber: nextNum,
      shotNumber: `${sceneObj?.order || 1}${String.fromCharCode(64 + nextNum)}`,
      visualDescription: 'Describe frame composition, subject placement, and lighting contrast.',
      cameraAngle: 'Eye Level',
      shotSize: 'Medium Shot',
      cameraDistance: '2.5m',
      cameraMovement: 'Static',
      composition: 'Rule of thirds',
      characterPositioning: '',
      environment: sceneObj?.environmentDescription || '',
      lighting: sceneObj?.lighting || 'Natural key light',
      mood: sceneObj?.emotionalTone || '',
      action: '',
      durationSec: 4,
      characterIds: sceneObj?.characterIds ? [...sceneObj.characterIds] : [],
      locationId: sceneObj?.locationId,
      costumeIds: sceneObj?.costumeIds ? [...sceneObj.costumeIds] : [],
      propIds: sceneObj?.propIds ? [...sceneObj.propIds] : [],
      referenceAssetId: sceneObj?.referenceAssetIds?.[0],
      referenceAssetIds: sceneObj?.referenceAssetIds ? [...sceneObj.referenceAssetIds] : [],
      generationPrompt: sceneObj?.positivePrompt || '',
      storyboardMode: 'reference_image',
      generationStatus: 'planned',
      approved: false,
      updatedAt: new Date().toISOString(),
    };
    store.upsertStoryboardFrame(newFrame);
    setSelectedFrameId(id);
    store.notify('success', `Added Storyboard Frame ${newFrame.shotNumber}`);
  };

  const handleRequestAiStoryboardImage = (frame: StoryboardFrameSpec) => {
    if (!imageRoute.executable) {
      store.upsertStoryboardFrame({
        ...frame,
        storyboardMode: 'ai_generated',
        generationStatus: 'failed',
        generationError: `Image generation unavailable: ${imageRoute.userNotice}. Use Reference Image or Text-Only mode until an image provider is configured.`,
      });
      store.notify('error', `Storyboard image generation unavailable: ${imageRoute.userNotice}`);
      return;
    }

    // Honest status transition without fabricating placeholder assets
    store.upsertStoryboardFrame({
      ...frame,
      storyboardMode: 'ai_generated',
      generationStatus: 'failed',
      generationError: `Provider "${imageRoute.provider?.name}" (${imageRoute.model?.id || 'unassigned'}) requires a live server image-render endpoint or ComfyUI flux/SDXL workflow. Attach a reference image or trigger generation in Generation Studio.`,
    });
    store.notify(
      'info',
      'Direct storyboard still rendering requires a live image endpoint; marked status honestly without placeholder fabrication.'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Storyboard Studio</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Organize scene-by-scene visual frames in text-only, reference-image, or capability-checked AI mode, convert frames to shots, and export contact sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter storyboard by scene"
            value={filterSceneId}
            onChange={(e) => setFilterSceneId(e.target.value)}
            className="h-9 px-2.5 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          >
            <option value="all">All Scenes ({project.storyboardFrames?.length || 0})</option>
            {project.scenes.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              downloadText(
                `${project.id}_storyboard_contact_sheet.html`,
                exportStoryboardContactSheetHtml(project),
                'text/html;charset=utf-8'
              )
            }
            className="h-9 px-3 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Contact Sheet HTML</span>
          </button>
          <button
            type="button"
            onClick={() =>
              downloadText(
                `${project.id}_storyboard.md`,
                renderStoryboardMarkdown(project),
                'text/markdown;charset=utf-8'
              )
            }
            className="h-9 px-3 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Markdown</span>
          </button>
          <button
            type="button"
            onClick={handleAddFrame}
            className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Frame</span>
          </button>
        </div>
      </div>

      {/* Visual Storyboard Card Canvas */}
      {frames.length === 0 ? (
        <div className="p-8 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] text-center text-xs text-[var(--ns-text-muted)]">
          No storyboard frames in this filter yet. Click Add Frame to start building the visual board.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {frames.map((frame, index) => {
            const scene = project.scenes.find((s) => s.id === frame.sceneId);
            const refAsset = project.mediaAssets.find(
              (a) => a.id === (frame.referenceAssetId || frame.referenceAssetIds?.[0])
            );
            const isSel = selected?.id === frame.id;
            const mode = frame.storyboardMode || 'reference_image';
            const showImage =
              mode === 'ai_generated'
                ? frame.generationStatus === 'generated'
                  ? frame.generatedImageUrl
                  : undefined
                : mode === 'reference_image'
                ? refAsset?.thumbnailUrl || refAsset?.dataUrl
                : undefined;

            return (
              <div
                key={frame.id}
                className={`rounded-lg border overflow-hidden bg-[var(--ns-surface)] flex flex-col transition-colors ${
                  isSel ? 'border-[var(--ns-accent)]' : 'border-[var(--ns-border)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedFrameId(frame.id)}
                  className="text-left flex-1 flex flex-col"
                >
                  {mode === 'text_only' || !showImage ? (
                    <div className="aspect-video w-full bg-[var(--ns-surface-inset)] border-b border-[var(--ns-border)] p-3 flex flex-col justify-between text-[11px] text-[var(--ns-text-muted)]">
                      <div className="flex items-center justify-between font-mono text-[var(--ns-text-subtle)]">
                        <span>{mode === 'text_only' ? 'TEXT STORYBOARD' : 'NO IMAGE ATTACHED'}</span>
                        <span>{frame.generationStatus || 'planned'}</span>
                      </div>
                      <div className="line-clamp-3 text-[var(--ns-text)]">{frame.visualDescription}</div>
                      <div className="text-[10px] text-[var(--ns-text-subtle)] truncate">
                        {frame.shotSize} · {frame.cameraAngle} · {frame.cameraMovement}
                      </div>
                    </div>
                  ) : (
                    <MediaThumb src={showImage} alt={`Frame ${frame.shotNumber}`} aspectClass="aspect-video" />
                  )}
                  <div className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      <span className="truncate">
                        Frame {frame.frameNumber || index + 1} · Shot {frame.shotNumber}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--ns-text-subtle)] tabular-nums">
                        {frame.durationSec}s
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--ns-text-muted)] truncate">
                      {scene?.title || frame.sceneId}
                    </div>
                    <div className="text-[11px] text-[var(--ns-text-subtle)]">
                      {frame.shotSize} · {frame.approved ? 'Approved' : 'Draft'}
                    </div>
                  </div>
                </button>

                <div className="px-3 py-2 border-t border-[var(--ns-border)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Move frame ${frame.shotNumber} up`}
                      onClick={() => store.reorderStoryboardFrame(frame.sceneId, frame.id, 'up')}
                      className="p-1 rounded border border-[var(--ns-border)]"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move frame ${frame.shotNumber} down`}
                      onClick={() => store.reorderStoryboardFrame(frame.sceneId, frame.id, 'down')}
                      className="p-1 rounded border border-[var(--ns-border)]"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => store.createShotFromStoryboard(frame)}
                    className="text-[11px] text-[var(--ns-accent-blue)] hover:underline font-medium"
                  >
                    + To Shot List
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Frame Inspector */}
      {selected && (
        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ns-border)] pb-3">
            <div>
              <div className="font-mono text-[11px] text-[var(--ns-text-subtle)]">
                {selected.id} · Status: {selected.generationStatus || 'planned'} · Mode:{' '}
                {(selected.storyboardMode || 'reference_image').replace('_', ' ')}
              </div>
              <h2 className="font-display text-base font-semibold">
                Frame {selected.frameNumber || 1} — Shot {selected.shotNumber}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleRequestAiStoryboardImage(selected)}
                className="h-8 px-3 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)] inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--ns-accent)]" />
                <span>Generate Frame Image</span>
              </button>
              <button
                type="button"
                onClick={() => store.createShotFromStoryboard(selected)}
                className="h-8 px-3 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)] inline-flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Create Shot</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  store.upsertStoryboardFrame({ ...selected, approved: !selected.approved })
                }
                className={`h-8 px-3 rounded border font-medium inline-flex items-center gap-1.5 ${
                  selected.approved
                    ? 'border-[var(--ns-success)] text-[var(--ns-success)] bg-[var(--ns-success)]/10'
                    : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{selected.approved ? 'Frame Approved' : 'Approve Frame'}</span>
              </button>
              {confirmDeleteId === selected.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      store.deleteStoryboardFrame(selected.id);
                      setConfirmDeleteId(null);
                    }}
                    className="h-8 px-2.5 rounded bg-[var(--ns-danger)] text-white"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="h-8 px-2.5 rounded border border-[var(--ns-border)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label={`Delete storyboard frame ${selected.shotNumber}`}
                  onClick={() => setConfirmDeleteId(selected.id)}
                  className="h-8 px-2.5 rounded border border-[var(--ns-danger)]/40 text-[var(--ns-danger)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {selected.generationError && (
            <div className="p-3 rounded border border-[var(--ns-warning)]/50 bg-[var(--ns-warning)]/10 text-[11px]">
              {selected.generationError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Storyboard Mode</label>
              <select
                value={selected.storyboardMode || 'reference_image'}
                onChange={(e) =>
                  store.upsertStoryboardFrame({
                    ...selected,
                    storyboardMode: e.target.value as StoryboardMode,
                  })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="reference_image">Reference Image Mode</option>
                <option value="text_only">Text-Only Mode</option>
                <option value="ai_generated">AI-Generated Mode (Capability-Checked)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Scene Link</label>
              <select
                value={selected.sceneId}
                onChange={(e) =>
                  store.upsertStoryboardFrame({ ...selected, sceneId: e.target.value })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                {project.scenes.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Primary Reference Asset</label>
              <select
                value={selected.referenceAssetId || ''}
                onChange={(e) =>
                  store.upsertStoryboardFrame({
                    ...selected,
                    referenceAssetId: e.target.value || undefined,
                  })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="">None attached</option>
                {project.mediaAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fileName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Shot Number</label>
              <input
                type="text"
                value={selected.shotNumber}
                onChange={(e) =>
                  store.upsertStoryboardFrame({ ...selected, shotNumber: e.target.value })
                }
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Shot Size</label>
              <select
                value={selected.shotSize}
                onChange={(e) =>
                  store.upsertStoryboardFrame({ ...selected, shotSize: e.target.value })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                {STANDARD_SHOT_SIZES.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Camera Angle</label>
              <select
                value={selected.cameraAngle}
                onChange={(e) =>
                  store.upsertStoryboardFrame({ ...selected, cameraAngle: e.target.value })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                {STANDARD_CAMERA_ANGLES.map((ang) => (
                  <option key={ang} value={ang}>
                    {ang}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Camera Movement</label>
              <select
                value={selected.cameraMovement}
                onChange={(e) =>
                  store.upsertStoryboardFrame({ ...selected, cameraMovement: e.target.value })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                {STANDARD_CAMERA_MOVEMENTS.map((mv) => (
                  <option key={mv} value={mv}>
                    {mv}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Lighting</label>
              <input
                type="text"
                value={selected.lighting}
                onChange={(e) =>
                  store.upsertStoryboardFrame({ ...selected, lighting: e.target.value })
                }
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Duration (sec)</label>
              <input
                type="number"
                min={1}
                value={selected.durationSec}
                onChange={(e) =>
                  store.upsertStoryboardFrame({
                    ...selected,
                    durationSec: Math.max(1, Number(e.target.value) || 4),
                  })
                }
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Visual Description</label>
              <textarea
                rows={2}
                value={selected.visualDescription}
                onChange={(e) =>
                  store.upsertStoryboardFrame({ ...selected, visualDescription: e.target.value })
                }
                className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Action & Movement Notes</label>
              <textarea
                rows={2}
                value={selected.action}
                onChange={(e) =>
                  store.upsertStoryboardFrame({ ...selected, action: e.target.value })
                }
                className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[var(--ns-text-muted)]">Storyboard Image Generation Prompt</label>
            <input
              type="text"
              value={selected.generationPrompt}
              onChange={(e) =>
                store.upsertStoryboardFrame({ ...selected, generationPrompt: e.target.value })
              }
              className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ShotListView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [filterSceneId, setFilterSceneId] = useState<string>('all');
  const [selectedShotId, setSelectedShotId] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!project) return null;

  const shots = (project.shotList || []).filter((sh) =>
    filterSceneId === 'all' ? true : sh.sceneId === filterSceneId
  );
  const selected = shots.find((s) => s.id === selectedShotId) || shots[0];

  const handleAddShot = () => {
    const targetSceneId = filterSceneId !== 'all' ? filterSceneId : project.scenes[0]?.id || '';
    const sceneObj = project.scenes.find((s) => s.id === targetSceneId);
    const id = `shot_${Date.now().toString(36)}`;
    const nextNum = `${sceneObj?.order || 1}${String.fromCharCode(65 + shots.length)}`;
    const created: ShotSpec = {
      id,
      sceneId: targetSceneId,
      shotNumber: nextNum,
      description: 'New camera shot setup',
      shotSize: 'Medium Shot',
      cameraAngle: 'Eye Level',
      cameraMovement: 'Static',
      lensGuidance: '35mm spherical prime',
      focalLengthMm: '35mm',
      cameraPosition: '',
      cameraHeight: 'Eye level',
      framing: 'Medium framing',
      composition: '',
      subject: '',
      characterPositioning: '',
      characterMovement: '',
      background: '',
      lightingSetup: sceneObj?.lighting || '',
      colorPalette: '',
      mood: sceneObj?.emotionalTone || '',
      focus: 'Subject eyes',
      depthOfField: 'f/2.8',
      priority: 'must_have',
      equipment: 'Camera body, tripod',
      personnel: 'Director, DP',
      propIds: [],
      costumeIds: [],
      specialEffects: '',
      audioRequirements: '',
      notes: '',
      durationSec: 4,
      approved: false,
      updatedAt: new Date().toISOString(),
    };
    store.upsertShot(created);
    setSelectedShotId(id);
    store.notify('success', `Added Shot ${created.shotNumber}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Shot List & Cinematography Planner</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Technical camera blocking, shot sizes, focal lengths, equipment, crew, audio specs, and production exports (CSV, JSON, Markdown, Printable PDF HTML).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter shot list by scene"
            value={filterSceneId}
            onChange={(e) => setFilterSceneId(e.target.value)}
            className="h-9 px-2.5 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          >
            <option value="all">All Scenes ({project.shotList?.length || 0})</option>
            {project.scenes.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              downloadText(`${project.id}_shot_list.csv`, exportShotListAsCsv(project), 'text/csv;charset=utf-8')
            }
            className="h-9 px-3 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs font-medium inline-flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() =>
              downloadText(
                `${project.id}_shot_list.json`,
                exportShotListAsJson(project),
                'application/json;charset=utf-8'
              )
            }
            className="h-9 px-3 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs font-medium inline-flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={() =>
              downloadText(
                `${project.id}_shot_list.md`,
                exportShotListAsMarkdown(project),
                'text/markdown;charset=utf-8'
              )
            }
            className="h-9 px-3 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs font-medium inline-flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>MD</span>
          </button>
          <button
            type="button"
            onClick={() =>
              downloadText(
                `${project.id}_shot_list_printable.html`,
                exportShotListAsPrintableHtml(project),
                'text/html;charset=utf-8'
              )
            }
            className="h-9 px-3 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs font-medium inline-flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF HTML</span>
          </button>
          <button
            type="button"
            onClick={handleAddShot}
            className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Shot</span>
          </button>
        </div>
      </div>

      {/* Dense Production Shot Table */}
      <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[780px]">
          <thead>
            <tr className="border-b border-[var(--ns-border)] text-[11px] text-[var(--ns-text-subtle)] bg-[var(--ns-surface-inset)]">
              <th className="py-2.5 px-3 font-medium">Shot #</th>
              <th className="py-2.5 px-3 font-medium">Scene</th>
              <th className="py-2.5 px-3 font-medium">Size</th>
              <th className="py-2.5 px-3 font-medium">Angle</th>
              <th className="py-2.5 px-3 font-medium">Movement</th>
              <th className="py-2.5 px-3 font-medium">Lens</th>
              <th className="py-2.5 px-3 font-medium">Dur.</th>
              <th className="py-2.5 px-3 font-medium">Priority</th>
              <th className="py-2.5 px-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ns-border)]">
            {shots.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[var(--ns-text-muted)]">
                  No shots planned yet. Add a shot above or promote a frame from Storyboard Studio.
                </td>
              </tr>
            ) : (
              shots.map((sh) => {
                const sceneTitle = project.scenes.find((s) => s.id === sh.sceneId)?.title || sh.sceneId;
                const isSel = selected?.id === sh.id;
                return (
                  <tr
                    key={sh.id}
                    onClick={() => setSelectedShotId(sh.id)}
                    className={`cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-[var(--ns-accent)]/10'
                        : 'hover:bg-[var(--ns-surface-elevated)]'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-semibold">{sh.shotNumber}</td>
                    <td className="py-2.5 px-3 max-w-[180px] truncate">{sceneTitle}</td>
                    <td className="py-2.5 px-3">{sh.shotSize}</td>
                    <td className="py-2.5 px-3">{sh.cameraAngle}</td>
                    <td className="py-2.5 px-3">{sh.cameraMovement}</td>
                    <td className="py-2.5 px-3 font-mono">{sh.focalLengthMm || sh.lensGuidance}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">{sh.durationSec}s</td>
                    <td className="py-2.5 px-3">{(sh.priority || 'important').replace(/_/g, ' ')}</td>
                    <td
                      className={`py-2.5 px-3 font-medium ${
                        sh.approved ? 'text-[var(--ns-success)]' : 'text-[var(--ns-warning)]'
                      }`}
                    >
                      {sh.approved ? 'Approved' : 'Draft'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Shot Detail Editor */}
      {selected && (
        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ns-border)] pb-3">
            <div>
              <div className="font-mono text-[11px] text-[var(--ns-text-subtle)]">
                {selected.id} · Storyboard Link: {selected.storyboardFrameId || 'None'} · Clip Link:{' '}
                {selected.linkedClipId || 'None'}
              </div>
              <h2 className="font-display text-base font-semibold">
                Shot {selected.shotNumber} — {selected.shotSize}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => store.setActiveSection('generation')}
                className="h-8 px-3 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)] inline-flex items-center gap-1.5"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Send to Generation Studio</span>
              </button>
              <button
                type="button"
                onClick={() => store.upsertShot({ ...selected, approved: !selected.approved })}
                className={`h-8 px-3 rounded border font-medium inline-flex items-center gap-1.5 ${
                  selected.approved
                    ? 'border-[var(--ns-success)] text-[var(--ns-success)] bg-[var(--ns-success)]/10'
                    : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{selected.approved ? 'Shot Approved' : 'Approve Shot'}</span>
              </button>
              {confirmDeleteId === selected.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      store.deleteShot(selected.id);
                      setConfirmDeleteId(null);
                    }}
                    className="h-8 px-2.5 rounded bg-[var(--ns-danger)] text-white"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="h-8 px-2.5 rounded border border-[var(--ns-border)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label={`Delete shot ${selected.shotNumber}`}
                  onClick={() => setConfirmDeleteId(selected.id)}
                  className="h-8 px-2.5 rounded border border-[var(--ns-danger)]/40 text-[var(--ns-danger)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Shot Number</label>
              <input
                type="text"
                value={selected.shotNumber}
                onChange={(e) => store.upsertShot({ ...selected, shotNumber: e.target.value })}
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Scene</label>
              <select
                value={selected.sceneId}
                onChange={(e) => store.upsertShot({ ...selected, sceneId: e.target.value })}
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                {project.scenes.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Storyboard Frame</label>
              <select
                value={selected.storyboardFrameId || ''}
                onChange={(e) =>
                  store.upsertShot({ ...selected, storyboardFrameId: e.target.value || undefined })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="">None</option>
                {(project.storyboardFrames || []).map((f) => (
                  <option key={f.id} value={f.id}>
                    Frame {f.frameNumber || ''} · {f.shotNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Priority</label>
              <select
                value={selected.priority || 'must_have'}
                onChange={(e) =>
                  store.upsertShot({ ...selected, priority: e.target.value as ShotPriority })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="must_have">Must Have</option>
                <option value="important">Important</option>
                <option value="optional">Optional / Pickup</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Shot Size (or custom)</label>
              <input
                list="shot-sizes-list"
                type="text"
                value={selected.shotSize}
                onChange={(e) => store.upsertShot({ ...selected, shotSize: e.target.value })}
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
              <datalist id="shot-sizes-list">
                {STANDARD_SHOT_SIZES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Camera Angle (or custom)</label>
              <input
                list="camera-angles-list"
                type="text"
                value={selected.cameraAngle}
                onChange={(e) => store.upsertShot({ ...selected, cameraAngle: e.target.value })}
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
              <datalist id="camera-angles-list">
                {STANDARD_CAMERA_ANGLES.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Camera Movement (or custom)</label>
              <input
                list="camera-movements-list"
                type="text"
                value={selected.cameraMovement}
                onChange={(e) => store.upsertShot({ ...selected, cameraMovement: e.target.value })}
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
              <datalist id="camera-movements-list">
                {STANDARD_CAMERA_MOVEMENTS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Focal Length / Lens</label>
              <input
                type="text"
                value={selected.focalLengthMm || selected.lensGuidance}
                onChange={(e) =>
                  store.upsertShot({
                    ...selected,
                    focalLengthMm: e.target.value,
                    lensGuidance: e.target.value,
                  })
                }
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Camera Position & Height</label>
              <input
                type="text"
                value={selected.cameraPosition || ''}
                onChange={(e) => store.upsertShot({ ...selected, cameraPosition: e.target.value })}
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Depth of Field / Focus</label>
              <input
                type="text"
                value={selected.depthOfField || ''}
                onChange={(e) => store.upsertShot({ ...selected, depthOfField: e.target.value })}
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Lighting Setup</label>
              <input
                type="text"
                value={selected.lightingSetup || ''}
                onChange={(e) => store.upsertShot({ ...selected, lightingSetup: e.target.value })}
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Duration (sec)</label>
              <input
                type="number"
                min={1}
                value={selected.durationSec}
                onChange={(e) =>
                  store.upsertShot({ ...selected, durationSec: Math.max(1, Number(e.target.value) || 4) })
                }
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Shot Description & Framing</label>
              <textarea
                rows={2}
                value={selected.description || ''}
                onChange={(e) => store.upsertShot({ ...selected, description: e.target.value })}
                className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Required Equipment & Rigging</label>
              <textarea
                rows={2}
                value={selected.equipment || ''}
                onChange={(e) => store.upsertShot({ ...selected, equipment: e.target.value })}
                className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Crew, Personnel & Audio/SFX Notes</label>
              <div className="grid grid-cols-1 gap-1.5">
                <input
                  type="text"
                  aria-label="Crew and personnel"
                  placeholder="Crew & personnel (e.g., Director, DP, Gaffer)"
                  value={selected.personnel || ''}
                  onChange={(e) => store.upsertShot({ ...selected, personnel: e.target.value })}
                  className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
                <input
                  type="text"
                  aria-label="Audio and special effects requirements"
                  placeholder="Audio / SFX notes"
                  value={selected.audioRequirements || ''}
                  onChange={(e) => store.upsertShot({ ...selected, audioRequirements: e.target.value })}
                  className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
