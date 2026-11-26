import { useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCode2,
  Film,
  HardDrive,
  RefreshCw,
  Server,
  Upload,
} from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import { evaluateProviderStatus } from '../../modules/ai-orchestration/orchestratorRules';
import { validateComfyWorkflowJson } from '../../modules/generation-engine/engineRules';
import { buildServerRenderOutputUrl } from '../../services/api/studioApi';
import type { ComfyConnectionStatus, EngineId, NavSection, QualityTier, WorkflowTemplate } from '../../types/studio';
import { AiProvidersView } from '../orchestration/AiOrchestrationViews';

function formatGb(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Not available';
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatComfyStatusLabel(status: ComfyConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting...';
    case 'authentication_required':
      return 'Authentication required';
    case 'unreachable':
      return 'Unreachable';
    case 'configuration_invalid':
      return 'Configuration invalid';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Unknown';
  }
}

export function ExportCenterView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  if (!project) return null;

  const { exportSettings } = project;
  const ffmpegAvailable = store.backendHealth?.ffmpegAvailable;
  const renderJob = store.activeRenderJob;

  const handleDownloadFfmpegBundle = () => {
    const script = [
      '#!/usr/bin/env bash',
      `# Neural Symphony Studio — FFmpeg Assembly Script for "${project.name}"`,
      '# Place rendered scene clips in ./clips/ matching filenames below.',
      '',
      ...project.timeline.blocks.map(
        (b, i) => `# Block ${i + 1}: ${b.title} (${b.durationSec}s, transition: ${b.transitionIn})`
      ),
      '',
      `ffmpeg -f concat -safe 0 -i concat_list.txt ${
        project.musicAsset ? `-i "${project.musicAsset.fileName}" -c:a aac -shortest ` : ''
      }-vf "scale=${exportSettings.width}:${exportSettings.height},fps=${exportSettings.fps}" -b:v ${
        exportSettings.videoBitrateMbps
      }M "${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.mp4"`,
    ].join('\n');

    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assemble_music_video.sh';
    a.click();
    URL.revokeObjectURL(url);
    store.notify('success', 'Downloaded FFmpeg assembly script');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Export Center</h1>
        <p className="text-xs text-[var(--ns-text-muted)] mt-1">
          Render MP4 music videos directly via server-side FFmpeg, download FFmpeg scripts, and export complete portable ZIP project archives.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4 text-xs">
          <h2 className="font-display text-base font-semibold">MP4 Render Configuration & Server Assembly</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Resolution</label>
              <select
                value={`${exportSettings.width}x${exportSettings.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  store.updateActiveProject((proj) => ({
                    ...proj,
                    exportSettings: { ...proj.exportSettings, width: w, height: h },
                  }));
                }}
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="1280x720">1280 x 720 (720p HD)</option>
                <option value="1920x1080">1920 x 1080 (1080p HD)</option>
                <option value="3840x2160">3840 x 2160 (4K UHD)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Frame Rate (FPS)</label>
              <select
                value={exportSettings.fps}
                onChange={(e) =>
                  store.updateActiveProject((proj) => ({
                    ...proj,
                    exportSettings: { ...proj.exportSettings, fps: Number(e.target.value) },
                  }))
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value={24}>24 fps (Cinema)</option>
                <option value={30}>30 fps</option>
                <option value={60}>60 fps</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={exportSettings.includeAudio}
                onChange={(e) =>
                  store.updateActiveProject((proj) => ({
                    ...proj,
                    exportSettings: { ...proj.exportSettings, includeAudio: e.target.checked },
                  }))
                }
              />
              <span>Include Master Audio Track</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={exportSettings.burnSubtitles}
                onChange={(e) =>
                  store.updateActiveProject((proj) => ({
                    ...proj,
                    exportSettings: { ...proj.exportSettings, burnSubtitles: e.target.checked },
                  }))
                }
              />
              <span>Burn Unicode Lyrics Subtitles</span>
            </label>
          </div>

          <div className="p-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] space-y-1">
            <div className="font-medium">
              FFmpeg Server Status:{' '}
              <span className={ffmpegAvailable ? 'text-[var(--ns-success)]' : 'text-[var(--ns-warning)]'}>
                {ffmpegAvailable ? 'Available' : 'Not available in this container'}
              </span>
            </div>
            <p className="text-[var(--ns-text-subtle)]">
              {ffmpegAvailable
                ? store.backendHealth?.ffmpegVersion
                : 'Configure an external FFmpeg render worker URL in Settings or download the FFmpeg assembly script.'}
            </p>
          </div>

          {renderJob && (
            <div className="p-3.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] space-y-2">
              <div className="flex items-center justify-between font-medium">
                <span>
                  Render Job {renderJob.id} ·{' '}
                  <span
                    className={
                      renderJob.status === 'completed'
                        ? 'text-[var(--ns-success)]'
                        : renderJob.status === 'failed'
                        ? 'text-[var(--ns-danger)]'
                        : 'text-[var(--ns-accent-blue)]'
                    }
                  >
                    {renderJob.stage}
                  </span>
                </span>
                <span className="font-mono tabular-nums">{renderJob.progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded bg-[var(--ns-border)] overflow-hidden">
                <div
                  className="h-full bg-[var(--ns-accent)] transition-all duration-200"
                  style={{ width: `${renderJob.progress}%` }}
                />
              </div>
              {renderJob.warnings && renderJob.warnings.length > 0 && (
                <div className="text-[11px] text-[var(--ns-warning)]">{renderJob.warnings.join(' ')}</div>
              )}
              {renderJob.errorMessage && (
                <div className="text-[11px] text-[var(--ns-danger)]">{renderJob.errorMessage}</div>
              )}
              {renderJob.status === 'completed' && (
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[11px] text-[var(--ns-text-muted)] tabular-nums">
                    {renderJob.outputFileName} · {((renderJob.outputSizeBytes || 0) / 1024).toFixed(1)} KB
                  </span>
                  <a
                    href={buildServerRenderOutputUrl(renderJob.id)}
                    download={renderJob.outputFileName || 'neural_symphony.mp4'}
                    className="h-8 px-3 rounded bg-[var(--ns-success)] text-white font-medium inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Rendered MP4</span>
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={!ffmpegAvailable || renderJob?.status === 'running' || renderJob?.status === 'queued'}
              onClick={() => void store.startServerMp4Render()}
              className="h-9 px-4 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] disabled:opacity-40 text-white font-medium inline-flex items-center gap-1.5"
            >
              <Film className="w-3.5 h-3.5" />
              <span>
                {renderJob?.status === 'running' ? 'Rendering MP4...' : 'Render MP4 via Server FFmpeg'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadFfmpegBundle}
              className="h-9 px-4 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface-elevated)] hover:border-[var(--ns-border-strong)] font-medium inline-flex items-center gap-1.5"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Download FFmpeg Assembly Script</span>
            </button>
          </div>
        </section>

        <section className="lg:col-span-5 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4 text-xs">
          <h2 className="font-display text-base font-semibold">Portable Project Archive (.ZIP)</h2>
          <p className="text-[var(--ns-text-muted)] leading-relaxed">
            Packages project metadata, manifest, Character Bible, Scene Plans, Prompt History, ComfyUI Workflows, Unicode LRC lyrics, embedded media files, and timeline settings into a portable ZIP archive.
          </p>
          <button
            type="button"
            onClick={() => void store.exportCurrentProjectZip()}
            className="w-full h-9 px-4 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface-elevated)] hover:border-[var(--ns-border-strong)] font-medium inline-flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Portable Project ZIP</span>
          </button>
        </section>
      </div>
    </div>
  );
}

const PIPELINE_STAGES: Array<{ id: NavSection; title: string; summary: string }> = [
  { id: 'media', title: '1. Images', summary: 'Ingest photos & ZIP packs' },
  { id: 'intelligence', title: '2. Analysis', summary: 'Structured vision JSON' },
  { id: 'characters', title: '3. Characters', summary: 'Character Bible lock' },
  { id: 'scenes', title: '4. Scenes', summary: 'Storyboard & framing' },
  { id: 'prompts', title: '5. Prompts', summary: 'Engine-adapted text' },
  { id: 'generation', title: '6. Video Gen', summary: 'ComfyUI / LTX / Wan' },
  { id: 'generation', title: '7. Review', summary: 'Quality & identity check' },
  { id: 'timeline', title: '8. Timeline', summary: 'Sync clips & lyrics' },
  { id: 'export', title: '9. Export', summary: 'FFmpeg MP4 & ZIP' },
];

export function WorkflowEditorView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [mode, setMode] = useState<'standard' | 'advanced'>('standard');
  const [selectedWfId, setSelectedWfId] = useState<string>('');
  const [jsonDraft, setJsonDraft] = useState<string>('');
  const importRef = useRef<HTMLInputElement>(null);

  if (!project) return null;

  const selectedWf = project.workflows.find((w) => w.id === selectedWfId) || project.workflows[0];
  const rawJson = jsonDraft || (selectedWf ? JSON.stringify(selectedWf.json, null, 2) : '{}');

  let parsedJson: unknown = null;
  let parseError = '';
  try {
    parsedJson = JSON.parse(rawJson);
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'Invalid JSON syntax';
  }
  const validation = parsedJson ? validateComfyWorkflowJson(parsedJson) : null;

  const handleSaveJson = () => {
    if (!selectedWf || !parsedJson || !validation?.valid) {
      store.notify('error', parseError || validation?.errors[0] || 'Fix JSON errors before saving.');
      return;
    }
    store.updateActiveProject((proj) => ({
      ...proj,
      workflows: proj.workflows.map((w) =>
        w.id === selectedWf.id
          ? { ...w, json: parsedJson as Record<string, unknown>, updatedAt: new Date().toISOString() }
          : w
      ),
    }));
    store.notify('success', `Saved workflow "${selectedWf.name}"`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Workflow Editor</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Switch between the guided 9-stage production pipeline and raw ComfyUI API workflow JSON inspection.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-md w-fit">
          <button
            type="button"
            onClick={() => setMode('standard')}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              mode === 'standard' ? 'bg-[var(--ns-accent)] text-white' : 'text-[var(--ns-text-muted)]'
            }`}
          >
            Standard Mode
          </button>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              mode === 'advanced' ? 'bg-[var(--ns-accent)] text-white' : 'text-[var(--ns-text-muted)]'
            }`}
          >
            Advanced ComfyUI JSON
          </button>
        </div>
      </div>

      {mode === 'standard' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PIPELINE_STAGES.map((stage) => (
            <button
              key={stage.title}
              type="button"
              onClick={() => store.setActiveSection(stage.id)}
              className="text-left p-4 rounded-lg bg-[var(--ns-surface)] border border-[var(--ns-border)] hover:border-[var(--ns-accent)] transition-colors space-y-1"
            >
              <div className="font-display text-sm font-semibold">{stage.title}</div>
              <div className="text-xs text-[var(--ns-text-muted)]">{stage.summary}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Workflow template"
                value={selectedWf?.id || ''}
                onChange={(e) => {
                  setSelectedWfId(e.target.value);
                  setJsonDraft('');
                }}
                className="h-9 px-3 text-xs rounded bg-[var(--ns-surface)] border border-[var(--ns-border)]"
              >
                {project.workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name} ({wf.engine})
                  </option>
                ))}
              </select>

              <input
                ref={importRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
                    const check = validateComfyWorkflowJson(parsed);
                    if (!check.valid) {
                      store.notify('error', check.errors[0]);
                      return;
                    }
                    const imported: WorkflowTemplate = {
                      id: `wf_${Date.now().toString(36)}`,
                      name: file.name.replace(/\.json$/i, ''),
                      engine: 'comfyui',
                      description: 'Imported ComfyUI API workflow JSON',
                      updatedAt: new Date().toISOString(),
                      json: parsed,
                    };
                    store.updateActiveProject((proj) => ({
                      ...proj,
                      workflows: [imported, ...proj.workflows],
                    }));
                    setSelectedWfId(imported.id);
                    setJsonDraft('');
                    store.notify('success', `Imported workflow "${imported.name}"`);
                  } catch {
                    store.notify('error', 'Failed to parse workflow JSON file');
                  }
                  e.target.value = '';
                }}
              />

              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="h-9 px-3 rounded border border-[var(--ns-border)] text-xs inline-flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!selectedWf) return;
                  const blob = new Blob([rawJson], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${selectedWf.id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="h-9 px-3 rounded border border-[var(--ns-border)] text-xs inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {store.settings.comfyUiUrl && (
                <a
                  href={store.settings.comfyUiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-3 rounded border border-[var(--ns-border)] text-xs inline-flex items-center gap-1.5"
                >
                  <span>Open External ComfyUI</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={handleSaveJson}
                className="h-9 px-4 rounded bg-[var(--ns-accent)] text-white text-xs font-medium"
              >
                Validate & Save Workflow
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <textarea
                rows={18}
                value={rawJson}
                onChange={(e) => setJsonDraft(e.target.value)}
                aria-label="ComfyUI Workflow API JSON"
                className="w-full p-3 rounded-lg bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono text-xs"
              />
            </div>
            <div className="lg:col-span-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-3 text-xs">
              <h2 className="font-display text-sm font-semibold">Workflow Structure Diagnostics</h2>
              {parseError ? (
                <div className="text-[var(--ns-danger)]">{parseError}</div>
              ) : validation ? (
                <div className="space-y-2">
                  <div>
                    Format:{' '}
                    <span className={validation.valid ? 'text-[var(--ns-success)]' : 'text-[var(--ns-danger)]'}>
                      {validation.format === 'api_workflow'
                        ? 'Valid API Workflow'
                        : validation.format === 'ui_workflow'
                        ? 'UI Workflow (Requires API Format)'
                        : 'Invalid'}
                    </span>
                  </div>
                  <div className="tabular-nums">Total Nodes: {validation.nodeCount}</div>
                  <div>Sampler Node: {validation.hasSampler ? 'Detected' : 'Not detected'}</div>
                  <div>CLIPTextEncode: {validation.hasPositivePrompt ? 'Detected' : 'Not detected'}</div>
                  <div>LoadImage: {validation.hasLoadImage ? 'Detected' : 'Not detected'}</div>
                  <div>Output Node: {validation.hasOutputNode ? 'Detected' : 'Not detected'}</div>
                  {validation.errors.length > 0 && (
                    <div className="text-[var(--ns-danger)]">{validation.errors.join(' ')}</div>
                  )}
                  <div className="pt-2 border-t border-[var(--ns-border)]">
                    <div className="text-[var(--ns-text-muted)] mb-1">Node Classes</div>
                    <div className="font-mono text-[11px] space-y-0.5">
                      {validation.nodeTypes.map((t) => (
                        <div key={t}>{t}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ModelManagerView({ store }: { store: StudioStore }) {
  const [catFilter, setCatFilter] = useState<'all' | string>('all');
  const filtered = store.modelCatalog.filter((m) => (catFilter === 'all' ? true : m.category === catFilter));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Model Manager & Capability Registry</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Verified models from connected backends plus multi-provider capability, licensing, and user-configurable cost metadata (prices are never fabricated).
          </p>
        </div>

        <button
          type="button"
          onClick={() => void store.checkComfyConnection()}
          className="h-9 px-3.5 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs font-medium inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh from ComfyUI</span>
        </button>
      </div>

      {/* Multi-Provider Capability & Cost Awareness Registry */}
      <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--ns-border)] flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold">AI Model Capability & Cost Classification Registry</h2>
          <span className="text-[11px] text-[var(--ns-text-subtle)]">
            Open-source weights still incur GPU/hosting costs when self-hosted.
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--ns-border)] bg-[var(--ns-surface-inset)] text-[var(--ns-text-subtle)]">
                <th className="py-2.5 px-4 font-medium">Model</th>
                <th className="py-2.5 px-4 font-medium">Capabilities</th>
                <th className="py-2.5 px-4 font-medium">Quality Tier</th>
                <th className="py-2.5 px-4 font-medium">Cost Class</th>
                <th className="py-2.5 px-4 font-medium">User Cost Estimate ($/1M tok)</th>
                <th className="py-2.5 px-4 font-medium">Provider Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ns-border)]">
              {store.aiModels.map((entry) => {
                const prov = store.aiProviders.find((p) => p.id === entry.providerId);
                const provStatus = prov
                  ? evaluateProviderStatus(prov, store.providerCredentials[prov.id], store.providerProbes[prov.id])
                  : 'unavailable';

                return (
                  <tr key={entry.id} className="align-top">
                    <td className="py-2.5 px-4">
                      <div className="font-medium">{entry.displayName}</div>
                      <div className="font-mono text-[11px] text-[var(--ns-text-subtle)]">{entry.modelId}</div>
                    </td>
                    <td className="py-2.5 px-4 text-[11px] text-[var(--ns-text-muted)]">
                      <div>
                        Vision: {entry.supportsImageInput ? 'Yes' : 'No'} · JSON:{' '}
                        {entry.supportsStructuredOutput ? 'Yes' : 'No'}
                      </div>
                      <div className="text-[var(--ns-text-subtle)]">
                        {entry.capabilities.slice(0, 3).map((c) => c.replace(/_/g, ' ')).join(' · ')}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <select
                        aria-label={`Quality tier for ${entry.displayName}`}
                        value={entry.qualityTier}
                        onChange={(e) =>
                          void store.updateModelEntry({
                            ...entry,
                            qualityTier: e.target.value as QualityTier,
                          })
                        }
                        className="h-7 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-[11px]"
                      >
                        <option value="preferred_quality">Preferred quality</option>
                        <option value="balanced">Balanced</option>
                        <option value="low_cost">Low-cost</option>
                        <option value="local_offline">Local / offline</option>
                        <option value="experimental">Experimental</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-4 text-[11px]">
                      <div>{entry.cost.classification.replace(/_/g, ' ')}</div>
                      {entry.cost.licensingNotes && (
                        <div className="text-[10px] text-[var(--ns-text-subtle)] max-w-[200px]">
                          {entry.cost.licensingNotes}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[11px]">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="In $"
                          aria-label={`Input cost for ${entry.displayName}`}
                          value={entry.cost.estimatedInputPer1MTokens ?? ''}
                          onChange={(e) =>
                            void store.updateModelEntry({
                              ...entry,
                              cost: {
                                ...entry.cost,
                                estimatedInputPer1MTokens:
                                  e.target.value === '' ? undefined : Number(e.target.value),
                                lastVerifiedDate: new Date().toISOString().slice(0, 10),
                              },
                            })
                          }
                          className="w-16 h-7 px-1.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                        />
                        <span>/</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="Out $"
                          aria-label={`Output cost for ${entry.displayName}`}
                          value={entry.cost.estimatedOutputPer1MTokens ?? ''}
                          onChange={(e) =>
                            void store.updateModelEntry({
                              ...entry,
                              cost: {
                                ...entry.cost,
                                estimatedOutputPer1MTokens:
                                  e.target.value === '' ? undefined : Number(e.target.value),
                                lastVerifiedDate: new Date().toISOString().slice(0, 10),
                              },
                            })
                          }
                          className="w-16 h-7 px-1.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-[11px]">
                      <span
                        className={
                          provStatus === 'connected' || provStatus === 'configured' || provStatus === 'available'
                            ? 'text-[var(--ns-success)]'
                            : 'text-[var(--ns-warning)]'
                        }
                      >
                        {provStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Video Engine & ComfyUI Checkpoints */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1 p-1 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-md w-fit">
          {(['all', 'image_understanding', 'video_generation', 'image_generation'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCatFilter(cat)}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                catFilter === cat ? 'bg-[var(--ns-accent)] text-white' : 'text-[var(--ns-text-muted)]'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--ns-border)] bg-[var(--ns-surface-inset)] text-[var(--ns-text-subtle)]">
                  <th className="py-2.5 px-4 font-medium">Model</th>
                  <th className="py-2.5 px-4 font-medium">Category</th>
                  <th className="py-2.5 px-4 font-medium">Provider</th>
                  <th className="py-2.5 px-4 font-medium">Engine</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-border)]">
                {filtered.map((m) => (
                  <tr key={m.id} className="h-11">
                    <td className="py-2 px-4">
                      <div className="font-medium">{m.name}</div>
                      {m.notes && <div className="text-[11px] text-[var(--ns-text-subtle)]">{m.notes}</div>}
                    </td>
                    <td className="py-2 px-4 text-[var(--ns-text-muted)]">{m.category.replace('_', ' ')}</td>
                    <td className="py-2 px-4 text-[var(--ns-text-muted)]">{m.provider}</td>
                    <td className="py-2 px-4 font-mono">{m.requiredEngine}</td>
                    <td className="py-2 px-4">
                      <span
                        className={
                          m.status === 'installed' || m.status === 'configured'
                            ? 'text-[var(--ns-success)]'
                            : m.status === 'not_connected'
                            ? 'text-[var(--ns-warning)]'
                            : 'text-[var(--ns-danger)]'
                        }
                      >
                        {m.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SystemMonitorView({ store }: { store: StudioStore }) {
  const { comfyStats, comfyStatus, backendHealth, activeProject, ltxCapability, wanCapability, comfyE2EResult } =
    store;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">System Monitor & Connection Diagnostics</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Live backend telemetry. Unavailable hardware metrics are reported strictly as Not available.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void store.checkComfyConnection()}
            className="h-9 px-4 rounded-md bg-[var(--ns-accent)] text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Run Connection Diagnostics</span>
          </button>
          <button
            type="button"
            onClick={() => void store.runComfyE2ETest()}
            className="h-9 px-4 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Run ComfyUI E2E Test</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold flex items-center gap-2">
              <Server className="w-4 h-4" />
              <span>ComfyUI & GPU Hardware</span>
            </h2>
            <span
              className={
                comfyStatus === 'connected'
                  ? 'text-[var(--ns-success)]'
                  : comfyStatus === 'authentication_required' || comfyStatus === 'configuration_invalid'
                  ? 'text-[var(--ns-danger)]'
                  : 'text-[var(--ns-warning)]'
              }
            >
              {formatComfyStatusLabel(comfyStatus)}
            </span>
          </div>

          <div className="divide-y divide-[var(--ns-border)]">
            {[
              ['Server URL', store.settings.comfyUiUrl || 'Not configured'],
              ['Server Auth Token (.env)', backendHealth?.comfyAuthConfigured ? 'Configured' : 'None configured'],
              ['Last Successful Connection', comfyStats?.lastSuccessfulConnection || 'Never'],
              ['Response Latency', comfyStats?.latencyMs != null ? `${comfyStats.latencyMs} ms` : 'Not available'],
              ['ComfyUI Version', comfyStats?.comfyVersion || 'Not available'],
              ['GPU Name', comfyStats?.gpuName || 'Not available'],
              ['GPU VRAM Total', formatGb(comfyStats?.vramTotalBytes)],
              ['GPU VRAM Free', formatGb(comfyStats?.vramFreeBytes)],
              ['System RAM Total', formatGb(comfyStats?.ramTotalBytes)],
              ['Operating System', comfyStats?.os || 'Not available'],
            ].map(([label, val]) => (
              <div key={label} className="py-2 flex justify-between gap-3">
                <span className="text-[var(--ns-text-muted)]">{label}</span>
                <span className="font-mono tabular-nums text-right truncate max-w-[230px]">{val}</span>
              </div>
            ))}
          </div>

          {comfyStats?.error && (
            <div className="p-2.5 rounded bg-[var(--ns-danger)]/10 border border-[var(--ns-danger)] text-[var(--ns-danger)]">
              Diagnostics: {comfyStats.error}. Ensure ComfyUI is started with `--listen` and reachable from the Studio server.
            </div>
          )}
        </div>

        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-3">
          <h2 className="font-display text-sm font-semibold flex items-center gap-2">
            <HardDrive className="w-4 h-4" />
            <span>Studio Server, Adapters & Queue</span>
          </h2>

          <div className="divide-y divide-[var(--ns-border)]">
            {[
              ['Studio API Status', backendHealth?.status || 'Checking...'],
              ['Node Runtime', backendHealth?.nodeVersion || 'Not available'],
              ['Server Gemini Key', backendHealth?.geminiConfigured ? 'Configured' : 'Not configured'],
              ['Active Gemini Model', store.settings.geminiModel],
              ['Local FFmpeg', backendHealth?.ffmpegAvailable ? 'Available' : 'Not available'],
              [
                'LTX-Video 0.9.5 Readiness',
                comfyStats?.connected
                  ? ltxCapability.ready
                    ? 'Ready'
                    : `Missing ${[...ltxCapability.missingNodes, ...ltxCapability.missingModels].join(', ')}`
                  : 'Connect ComfyUI to inspect',
              ],
              [
                'Wan 2.1 I2V Readiness',
                comfyStats?.connected
                  ? wanCapability.ready
                    ? 'Ready'
                    : `Missing ${[...wanCapability.missingNodes, ...wanCapability.missingModels].join(', ')}`
                  : 'Connect ComfyUI to inspect',
              ],
              [
                'Active Live / Queued Jobs',
                String(
                  activeProject?.jobs.filter(
                    (j) =>
                      j.status === 'running' ||
                      j.status === 'queued' ||
                      j.status === 'submitting' ||
                      j.status === 'pending'
                  ).length || 0
                ),
              ],
              ['Completed Jobs', String(activeProject?.jobs.filter((j) => j.status === 'completed').length || 0)],
              ['Failed Jobs', String(activeProject?.jobs.filter((j) => j.status === 'failed').length || 0)],
            ].map(([label, val]) => (
              <div key={label} className="py-2 flex justify-between gap-3">
                <span className="text-[var(--ns-text-muted)]">{label}</span>
                <span className="font-mono tabular-nums text-right truncate max-w-[230px]">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {comfyE2EResult && (
        <section className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">ComfyUI End-to-End Integration Test Result</h2>
            <span className={comfyE2EResult.success ? 'text-[var(--ns-success)]' : 'text-[var(--ns-danger)]'}>
              {comfyE2EResult.success ? 'PASSED' : 'FAILED'} · {comfyE2EResult.durationMs}ms
            </span>
          </div>
          {comfyE2EResult.error && <p className="text-[var(--ns-danger)]">{comfyE2EResult.error}</p>}
          {comfyE2EResult.promptId && (
            <div className="font-mono text-[var(--ns-text-muted)]">
              Checkpoint: {comfyE2EResult.checkpointUsed} · Prompt ID: {comfyE2EResult.promptId}
            </div>
          )}
          {comfyE2EResult.outputImageUrl && (
            <img
              src={comfyE2EResult.outputImageUrl}
              alt="ComfyUI E2E Test Output"
              className="max-w-xs rounded border border-[var(--ns-border)]"
            />
          )}
        </section>
      )}
    </div>
  );
}

export function SettingsView({ store }: { store: StudioStore }) {
  const [comfyUrl, setComfyUrl] = useState(store.settings.comfyUiUrl);
  const [comfyTimeoutMs, setComfyTimeoutMs] = useState(store.settings.comfyTimeoutMs || 8000);
  const [qwenUrl, setQwenUrl] = useState(store.settings.qwenVlEndpointUrl);
  const [qwenModel, setQwenModel] = useState(store.settings.qwenVlModelId);
  const [geminiModel, setGeminiModel] = useState(store.settings.geminiModel || 'gemini-4-hydrogen');
  const [ffmpegUrl, setFfmpegUrl] = useState(store.settings.ffmpegServiceUrl);
  const [defaultEngine, setDefaultEngine] = useState<EngineId>(store.settings.defaultEngine);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await store.updateSettings({
      comfyUiUrl: comfyUrl.trim(),
      comfyTimeoutMs: Math.max(1000, Math.min(60000, Number(comfyTimeoutMs) || 8000)),
      qwenVlEndpointUrl: qwenUrl.trim(),
      qwenVlModelId: qwenModel.trim() || 'Qwen/Qwen2.5-VL-3B-Instruct',
      geminiModel,
      ffmpegServiceUrl: ffmpegUrl.trim(),
      defaultEngine,
    });
    store.notify('success', 'Saved studio settings');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-xl font-semibold">Studio Settings</h1>
        <p className="text-xs text-[var(--ns-text-muted)] mt-1">
          Configure external GPU endpoints, timeouts, appearance theme, and default generation adapter. Server tokens belong strictly in environment variables (`.env`).
        </p>
      </div>

      {/* Theme Selector */}
      <section className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-sm font-semibold">Interface Theme</h2>
          <p className="text-xs text-[var(--ns-text-muted)]">Dark studio theme is active by default.</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] rounded-md">
          <button
            type="button"
            onClick={() => void store.updateSettings({ theme: 'dark' })}
            className={`px-3 py-1 rounded text-xs font-medium ${
              store.settings.theme === 'dark' ? 'bg-[var(--ns-accent)] text-white' : 'text-[var(--ns-text-muted)]'
            }`}
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => void store.updateSettings({ theme: 'light' })}
            className={`px-3 py-1 rounded text-xs font-medium ${
              store.settings.theme === 'light' ? 'bg-[var(--ns-accent)] text-white' : 'text-[var(--ns-text-muted)]'
            }`}
          >
            Light
          </button>
        </div>
      </section>

      <form
        onSubmit={(e) => void handleSave(e)}
        className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4 text-xs"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold">ComfyUI GPU Backend</h2>
          <span
            className={
              store.comfyStatus === 'connected'
                ? 'text-[var(--ns-success)] font-medium'
                : store.comfyStatus === 'authentication_required' || store.comfyStatus === 'configuration_invalid'
                ? 'text-[var(--ns-danger)] font-medium'
                : 'text-[var(--ns-warning)] font-medium'
            }
          >
            {formatComfyStatusLabel(store.comfyStatus)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-9 space-y-1.5">
            <label htmlFor="settings-comfy-url" className="block text-[var(--ns-text-muted)]">
              ComfyUI Server URL (Local, Colab Tunnel, or Remote GPU)
            </label>
            <div className="flex gap-2">
              <input
                id="settings-comfy-url"
                type="url"
                value={comfyUrl}
                onChange={(e) => setComfyUrl(e.target.value)}
                placeholder="http://127.0.0.1:8188"
                className="flex-1 h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
              />
              <button
                type="button"
                onClick={() => void store.checkComfyConnection(comfyUrl, comfyTimeoutMs)}
                className="h-9 px-3.5 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)] whitespace-nowrap"
              >
                Test Connection
              </button>
            </div>
          </div>

          <div className="sm:col-span-3 space-y-1.5">
            <label htmlFor="settings-comfy-timeout" className="block text-[var(--ns-text-muted)]">
              Timeout (ms)
            </label>
            <input
              id="settings-comfy-timeout"
              type="number"
              min={1000}
              max={60000}
              step={500}
              value={comfyTimeoutMs}
              onChange={(e) => setComfyTimeoutMs(Number(e.target.value) || 8000)}
              className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono tabular-nums"
            />
          </div>
        </div>

        <div className="p-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] space-y-1">
          <div className="flex flex-wrap justify-between gap-2 text-[var(--ns-text-muted)]">
            <span>Last Successful Connection: {store.comfyStats?.lastSuccessfulConnection || 'Never'}</span>
            <span>
              Server Token (COMFYUI_API_TOKEN):{' '}
              {store.backendHealth?.comfyAuthConfigured ? 'Configured in server env' : 'None'}
            </span>
          </div>
          {store.comfyStats?.error && (
            <div className="text-[var(--ns-danger)] pt-1">Error: {store.comfyStats.error}</div>
          )}
        </div>

        <div className="pt-2 border-t border-[var(--ns-border)] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Vision & AI Adapters</h2>
            {store.qwenReport && (
              <span className={store.qwenReport.connected ? 'text-[var(--ns-success)]' : 'text-[var(--ns-danger)]'}>
                Qwen: {store.qwenReport.connected ? `Connected (${store.qwenReport.latencyMs}ms)` : 'Unavailable'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="settings-qwen-url" className="block text-[var(--ns-text-muted)]">
                External Qwen2.5-VL Endpoint URL
              </label>
              <div className="flex gap-2">
                <input
                  id="settings-qwen-url"
                  type="url"
                  value={qwenUrl}
                  onChange={(e) => setQwenUrl(e.target.value)}
                  placeholder="https://your-vlm-endpoint.example"
                  className="flex-1 h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
                />
                <button
                  type="button"
                  onClick={() => void store.checkQwenConnection(qwenUrl)}
                  className="h-9 px-3 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)] whitespace-nowrap"
                >
                  Test
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-qwen-model" className="block text-[var(--ns-text-muted)]">
                Vision Model ID
              </label>
              <input
                id="settings-qwen-model"
                type="text"
                value={qwenModel}
                onChange={(e) => setQwenModel(e.target.value)}
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="settings-gemini-model" className="block text-[var(--ns-text-muted)]">
                Server Gemini Model
              </label>
              <select
                id="settings-gemini-model"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="gemini-4-hydrogen">gemini-4-hydrogen (Balanced)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-ffmpeg-url" className="block text-[var(--ns-text-muted)]">
                External FFmpeg Worker URL (Optional)
              </label>
              <input
                id="settings-ffmpeg-url"
                type="url"
                value={ffmpegUrl}
                onChange={(e) => setFfmpegUrl(e.target.value)}
                placeholder="https://render-worker.example"
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="settings-default-engine" className="block text-[var(--ns-text-muted)]">
                Default Video Engine
              </label>
              <select
                id="settings-default-engine"
                value={defaultEngine}
                onChange={(e) => setDefaultEngine(e.target.value as EngineId)}
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="ltx-video">Lightricks/LTX-Video-0.9.5</option>
                <option value="wan-2.1">Wan2.1-I2V-14B</option>
                <option value="comfyui">ComfyUI Custom Workflow</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <span className="text-[var(--ns-text-subtle)] inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ns-success)]" />
            <span>Persisted locally in IndexedDB</span>
          </span>
          <button
            type="submit"
            className="h-9 px-4 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white font-medium"
          >
            Save Settings
          </button>
        </div>
      </form>

      <div className="pt-4 border-t border-[var(--ns-border)]">
        <AiProvidersView store={store} embedded />
      </div>
    </div>
  );
}
