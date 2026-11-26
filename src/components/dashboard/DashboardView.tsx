import { ArrowRight, CheckCircle2, AlertTriangle, Server, Film } from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import { ENGINE_REGISTRY } from '../../modules/generation-engine/engineRules';
import { MediaThumb } from '../shared/MediaThumb';

export function DashboardView({ store }: { store: StudioStore }) {
  const { projects, activeProject, comfyStats, backendHealth, modelCatalog } = store;

  const totals = projects.reduce(
    (acc, p) => {
      acc.totalProjects += 1;
      if (p.status === 'in_production' || p.status === 'review') acc.activeProjects += 1;
      if (p.status === 'completed') acc.completedProductions += 1;
      acc.uploadedImages += p.mediaAssets.length;
      acc.analyzedImages += Object.keys(p.analyses).length;
      acc.characters += p.characters.length;
      acc.scenes += p.scenes.length;
      acc.clips += p.clips.length;
      acc.pendingJobs += p.jobs.filter(
        (j) => j.status === 'pending' || j.status === 'submitting' || j.status === 'queued' || j.status === 'running'
      ).length;
      acc.failedJobs += p.jobs.filter((j) => j.status === 'failed').length;
      return acc;
    },
    {
      totalProjects: 0,
      activeProjects: 0,
      uploadedImages: 0,
      analyzedImages: 0,
      characters: 0,
      scenes: 0,
      clips: 0,
      completedProductions: 0,
      pendingJobs: 0,
      failedJobs: 0,
    }
  );

  const engineInfo = ENGINE_REGISTRY[store.settings.defaultEngine];
  const installedOrConfiguredModels = modelCatalog.filter(
    (m) => m.status === 'installed' || m.status === 'configured'
  ).length;

  const recentJobs = activeProject?.jobs.slice(0, 5) || [];

  const kpis = [
    { label: 'Total Projects', value: totals.totalProjects },
    { label: 'Active Projects', value: totals.activeProjects },
    { label: 'Uploaded Images', value: totals.uploadedImages },
    { label: 'Analyzed Images', value: totals.analyzedImages },
    { label: 'Identified Characters', value: totals.characters },
    { label: 'Planned Scenes', value: totals.scenes },
    { label: 'Generated Clips', value: totals.clips },
    { label: 'Completed Productions', value: totals.completedProductions },
    { label: 'Pending Jobs', value: totals.pendingJobs },
    { label: 'Failed Jobs', value: totals.failedJobs },
  ];

  return (
    <div className="space-y-6">
      {/* Active Production Header */}
      <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 text-xs text-[var(--ns-text-muted)]">
            <span>Active Workspace</span>
            <span aria-hidden="true">·</span>
            <span>{activeProject?.status.replace('_', ' ') || 'ready'}</span>
            {activeProject?.isDemoProject && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[var(--ns-accent-blue)]">Demo Project Data</span>
              </>
            )}
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">
            {activeProject?.name || 'Neural Symphony Studio'}
          </h1>
          <p className="text-sm text-[var(--ns-text-muted)] leading-relaxed">
            {activeProject?.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => store.setActiveSection('generation')}
            className="h-9 px-4 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Open Generation Studio</span>
          </button>
          <button
            type="button"
            onClick={() => store.setActiveSection('media')}
            className="h-9 px-4 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface-elevated)] hover:border-[var(--ns-border-strong)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Upload Media</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 10 Studio KPIs */}
      <section aria-label="Production metrics" className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map((item) => (
          <div
            key={item.label}
            className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-3.5"
          >
            <div className="text-xs text-[var(--ns-text-muted)] truncate">{item.label}</div>
            <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-[var(--ns-text)]">
              {item.value}
            </div>
          </div>
        ))}
      </section>

      {/* Main 2-Column Split: Projects + Infrastructure Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Projects & Storyboard Preview */}
        <section className="lg:col-span-7 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold">Recent Projects</h2>
              <button
                type="button"
                onClick={() => store.setActiveSection('projects')}
                className="text-xs text-[var(--ns-accent-blue)] hover:underline whitespace-nowrap"
              >
                Manage All
              </button>
            </div>

            <div className="divide-y divide-[var(--ns-border)]">
              {projects.slice(0, 4).map((proj) => {
                const isCurrent = proj.id === activeProject?.id;
                return (
                  <div
                    key={proj.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{proj.name}</span>
                        {isCurrent && (
                          <span className="text-xs text-[var(--ns-accent)] whitespace-nowrap">Active</span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--ns-text-subtle)] tabular-nums mt-0.5">
                        {proj.mediaAssets.length} assets · {proj.scenes.length} scenes · {proj.clips.length} clips
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void store.selectProject(proj.id)}
                      className="h-8 px-3 rounded-md border border-[var(--ns-border)] text-xs font-medium hover:bg-[var(--ns-surface-elevated)] whitespace-nowrap shrink-0"
                    >
                      {isCurrent ? 'Selected' : 'Open'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {activeProject && activeProject.mediaAssets.length > 0 && (
            <div className="pt-4 border-t border-[var(--ns-border)]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-medium text-[var(--ns-text-muted)]">
                  Active Project Reference Frames
                </span>
                <button
                  type="button"
                  onClick={() => store.setActiveSection('scenes')}
                  className="text-xs text-[var(--ns-text-muted)] hover:text-[var(--ns-text)]"
                >
                  Open Storyboard
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                {activeProject.mediaAssets.slice(0, 4).map((asset) => (
                  <MediaThumb
                    key={asset.id}
                    src={asset.thumbnailUrl}
                    alt={asset.fileName}
                    className="rounded border border-[var(--ns-border)]"
                    aspectClass="aspect-[16/10]"
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* System Health & Backend Connections */}
        <section className="lg:col-span-5 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Backend & Engine Readiness</h2>
            <button
              type="button"
              onClick={() => void store.checkComfyConnection()}
              className="h-7 px-3 rounded-md border border-[var(--ns-border)] text-xs font-medium hover:bg-[var(--ns-surface-elevated)] whitespace-nowrap"
            >
              Test ComfyUI
            </button>
          </div>

          <div className="divide-y divide-[var(--ns-border)] text-xs">
            <div className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-[var(--ns-text)]">ComfyUI Generation Server</div>
                <div className="text-[var(--ns-text-subtle)] font-mono truncate max-w-[230px]">
                  {store.settings.comfyUiUrl || 'Not configured'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {comfyStats?.connected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ns-success)]" />
                    <span className="text-[var(--ns-success)] tabular-nums">
                      Connected ({comfyStats.latencyMs}ms)
                    </span>
                  </>
                ) : (
                  <>
                    <Server className="w-3.5 h-3.5 text-[var(--ns-warning)]" />
                    <span className="text-[var(--ns-warning)] capitalize">
                      {store.comfyStatus.replace(/_/g, ' ')}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-[var(--ns-text)]">Selected Default Engine</div>
                <div className="text-[var(--ns-text-subtle)]">{engineInfo.targetModel}</div>
              </div>
              <span className="font-mono text-[var(--ns-text)]">{engineInfo.name}</span>
            </div>

            <div className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-[var(--ns-text)]">Server Gemini Intelligence</div>
                <div className="text-[var(--ns-text-subtle)]">Vision analysis & scene planning</div>
              </div>
              <span className={backendHealth?.geminiConfigured ? 'text-[var(--ns-success)]' : 'text-[var(--ns-warning)]'}>
                {backendHealth?.geminiConfigured ? 'Configured' : 'Awaiting Key'}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-[var(--ns-text)]">Model Availability</div>
                <div className="text-[var(--ns-text-subtle)]">Verified via backend & config</div>
              </div>
              <span className="tabular-nums text-[var(--ns-text)]">
                {installedOrConfiguredModels} / {modelCatalog.length} ready
              </span>
            </div>

            <div className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-[var(--ns-text)]">Local FFmpeg Binary</div>
                <div className="text-[var(--ns-text-subtle)]">Server-side MP4 video assembly</div>
              </div>
              <span className={backendHealth?.ffmpegAvailable ? 'text-[var(--ns-success)]' : 'text-[var(--ns-text-muted)]'}>
                {backendHealth?.ffmpegAvailable ? 'Available' : 'Not available'}
              </span>
            </div>
          </div>

          {!comfyStats?.connected && (
            <div className="p-3 rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-xs text-[var(--ns-text-muted)] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--ns-warning)] shrink-0 mt-0.5" />
              <span>
                External ComfyUI GPU server is disconnected. Offline Simulation Mode remains available for planning, prompt testing, and pipeline verification.
              </span>
            </div>
          )}
        </section>
      </div>

      {/* Recent Generation Activity Table */}
      <section className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-semibold">Recent Generation Activity</h2>
          <button
            type="button"
            onClick={() => store.setActiveSection('queue')}
            className="text-xs text-[var(--ns-accent-blue)] hover:underline"
          >
            View Job Queue
          </button>
        </div>

        {recentJobs.length === 0 ? (
          <p className="text-xs text-[var(--ns-text-muted)] py-4">
            No generation jobs recorded in the active project yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--ns-border)] text-[var(--ns-text-subtle)]">
                  <th className="py-2 pr-4 font-medium">Job ID</th>
                  <th className="py-2 pr-4 font-medium">Engine & Model</th>
                  <th className="py-2 pr-4 font-medium">Execution Mode</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ns-border)]">
                {recentJobs.map((job) => (
                  <tr key={job.id} className="h-10">
                    <td className="py-2 pr-4 font-mono">{job.id}</td>
                    <td className="py-2 pr-4">
                      {job.engine} · <span className="text-[var(--ns-text-muted)]">{job.modelName}</span>
                    </td>
                    <td className="py-2 pr-4 text-[var(--ns-text-muted)]">
                      {job.mode === 'offline_simulation' ? 'Offline Simulation' : 'ComfyUI Live'}
                    </td>
                    <td className="py-2 pr-4">
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
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{job.progress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
