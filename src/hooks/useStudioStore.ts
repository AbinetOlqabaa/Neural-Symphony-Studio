import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBlankProject, createDemoProject } from '../data/demoProject';
import {
  ENGINE_REGISTRY,
  buildComfyE2ETestWorkflow,
  injectSceneIntoWorkflow,
  inspectEngineCapabilities,
  validateComfyWorkflowJson,
  validateGenerationParams,
} from '../modules/generation-engine/engineRules';
import {
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_TASK_ROUTING_RULES,
  resolveTaskRoute,
  type ProviderProbeSnapshot,
} from '../modules/ai-orchestration/orchestratorRules';
import { analyzeProjectContinuity } from '../modules/continuity/continuityEngine';
import {
  addDocumentComment,
  createProductionDocument,
  renderBreakdownMarkdown,
  renderCharacterBibleMarkdown,
  renderCompletePreProductionPackageMarkdown,
  renderCostumeBibleMarkdown,
  renderCreativeBriefMarkdown,
  renderLocationBibleMarkdown,
  renderProductionScheduleMarkdown,
  renderPropsListMarkdown,
  renderScreenplayMarkdown,
  renderShotListMarkdown,
  renderStoryboardMarkdown,
  setDocumentStatus,
  updateProductionDocumentWithVersion,
} from '../modules/production/documentSystem';
import {
  buildShotFromStoryboardFrame,
  removeCostumeSafely,
  removeLocationSafely,
  removeProductionTaskSafely,
  removePropSafely,
  removeShotSafely,
  removeStoryboardFrameSafely,
  reorderStoryboardFramesForScene,
} from '../modules/production/preProductionEngine';
import { ingestMediaFiles, urlToBase64, type IngestionReport } from '../modules/media-ingestion/mediaImporter';
import { exportProjectToZipBlob, importProjectFromZipBuffer } from '../modules/persistence/projectArchive';
import { migrateProjectSchema } from '../modules/persistence/projectMigration';
import { compileStructuredPrompt, estimatePromptTokens } from '../modules/prompt-engineering/promptCompiler';
import {
  analyzeImageViaGemini,
  analyzeImageViaQwen,
  buildComfyViewUrl,
  createServerRenderJob,
  executeOrchestratedAiTask,
  fetchBackendHealth,
  fetchComfyUiHistory,
  fetchComfyUiModels,
  fetchProviderCredentialsStatus,
  fetchServerRenderJob,
  generateAiScenePlan,
  interruptComfyUi,
  saveProviderSessionCredential,
  submitComfyUiWorkflow,
  subscribeComfyUiEvents,
  synthesizeAiPrompt,
  testAiProvider,
  testComfyUiConnection,
  testQwenEndpointConnection,
  uploadImageToComfyUi,
  type BackendHealth,
} from '../services/api/studioApi';
import {
  DEFAULT_STUDIO_SETTINGS,
  deleteProjectRecord,
  loadActiveProjectId,
  loadAllProjects,
  loadStudioSettings,
  saveActiveProjectId,
  saveProjectRecord,
  saveStudioSettings,
} from '../services/storage/indexedDbStore';
import type {
  AIModelEntry,
  AIProviderConfig,
  AssetCategory,
  CharacterEntry,
  ClipApprovalState,
  ComfyConnectionStatus,
  ComfyObjectInfoSummary,
  ComfyOutputFileRef,
  ComfyUISystemStats,
  ContinuityAlert,
  CostumeSpec,
  CreativeBrief,
  DocumentStatus,
  EngineId,
  GenerationJob,
  GenerationParameters,
  ImageAnalysis,
  LocationSpec,
  LyricLine,
  ModelCatalogEntry,
  NavSection,
  ProductionDocument,
  ProductionTask,
  Project,
  ProjectStatus,
  PromptVersion,
  PropSpec,
  QualityChecklist,
  RenderJobStatus,
  RoutingPriority,
  ScenePlan,
  ScreenplaySceneSection,
  ServerCredentialStatus,
  ShotSpec,
  StoryboardFrameSpec,
  StudioSettings,
  TaskRoutingRule,
  TaskType,
  TimelineBlock,
  VideoClip,
  VisionProviderId,
} from '../types/studio';

export interface QwenConnectionReport {
  connected: boolean;
  url: string;
  latencyMs: number | null;
  models: string[];
  authConfigured: boolean;
  error?: string;
  checkedAt: string;
}

export interface ComfyE2EDiagnosticResult {
  ranAt: string;
  success: boolean;
  checkpointUsed?: string;
  promptId?: string;
  durationMs: number;
  outputImageUrl?: string;
  error?: string;
}

export function useStudioStore() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_STUDIO_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [comfyStats, setComfyStats] = useState<ComfyUISystemStats | null>(null);
  const [comfyStatusOverride, setComfyStatusOverride] = useState<ComfyConnectionStatus | null>(null);
  const [comfyModels, setComfyModels] = useState<ComfyObjectInfoSummary | null>(null);
  const [qwenReport, setQwenReport] = useState<QwenConnectionReport | null>(null);
  const [activeRenderJob, setActiveRenderJob] = useState<RenderJobStatus | null>(null);
  const [comfyE2EResult, setComfyE2EResult] = useState<ComfyE2EDiagnosticResult | null>(null);
  const [providerCredentials, setProviderCredentials] = useState<Record<string, ServerCredentialStatus>>({});
  const [providerProbes, setProviderProbes] = useState<
    Record<string, ProviderProbeSnapshot & { discoveredModels?: string[] }>
  >({});
  const [toastMessage, setToastMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  const autosaveTimerRef = useRef<number | null>(null);

  const notify = useCallback((type: 'info' | 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    window.setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Hydrate projects, active project, settings, and backend health
  useEffect(() => {
    let mounted = true;
    async function init() {
      const [storedProjects, storedSettings, storedActiveId] = await Promise.all([
        loadAllProjects(),
        loadStudioSettings(),
        loadActiveProjectId(),
      ]);

      let initialProjects = storedProjects;
      if (initialProjects.length === 0) {
        const demo = createDemoProject();
        await saveProjectRecord(demo);
        initialProjects = [demo];
      }

      const resolvedActiveId =
        storedActiveId && initialProjects.some((p) => p.id === storedActiveId)
          ? storedActiveId
          : initialProjects[0].id;

      if (!mounted) return;
      setProjects(initialProjects);
      setActiveProjectId(resolvedActiveId);
      setSettings(storedSettings);
      setHydrated(true);

      try {
        const [health, creds] = await Promise.all([
          fetchBackendHealth(),
          fetchProviderCredentialsStatus(storedSettings.aiProviders || DEFAULT_AI_PROVIDERS),
        ]);
        if (mounted) {
          setBackendHealth(health);
          setProviderCredentials(creds);
        }
      } catch {
        // Backend health checked silently
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0] || null,
    [projects, activeProjectId]
  );

  const effectiveComfyStatus: ComfyConnectionStatus = useMemo(() => {
    if (comfyStatusOverride) return comfyStatusOverride;
    if (comfyStats) return comfyStats.status;
    return settings.comfyUiUrl.trim() ? 'disconnected' : 'unknown';
  }, [comfyStatusOverride, comfyStats, settings.comfyUiUrl]);

  const persistProject = useCallback(async (project: Project) => {
    setSaveStatus('saving');
    try {
      const updated = { ...project, updatedAt: new Date().toISOString() };
      await saveProjectRecord(updated);
      setSaveStatus('saved');
      setLastSavedAt(updated.updatedAt);
    } catch {
      setSaveStatus('error');
    }
  }, []);

  const updateActiveProject = useCallback(
    (updater: (prev: Project) => Project) => {
      setProjects((prevList) =>
        prevList.map((proj) => {
          if (proj.id !== activeProjectId) return proj;
          const next = { ...updater(proj), updatedAt: new Date().toISOString() };
          if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
          setSaveStatus('saving');
          autosaveTimerRef.current = window.setTimeout(() => {
            void persistProject(next);
          }, 350);
          return next;
        })
      );
    },
    [activeProjectId, persistProject]
  );

  const selectProject = useCallback(async (projectId: string) => {
    setActiveProjectId(projectId);
    await saveActiveProjectId(projectId);
  }, []);

  const createProject = useCallback(
    async (name: string, description: string) => {
      const proj = createBlankProject(name, description);
      await saveProjectRecord(proj);
      await saveActiveProjectId(proj.id);
      setProjects((prev) => [proj, ...prev]);
      setActiveProjectId(proj.id);
      notify('success', `Created project "${proj.name}"`);
      return proj;
    },
    [notify]
  );

  const duplicateProject = useCallback(
    async (projectId: string) => {
      const source = projects.find((p) => p.id === projectId);
      if (!source) return;
      const now = new Date().toISOString();
      const copy: Project = {
        ...JSON.parse(JSON.stringify(source)),
        id: `proj_${Date.now().toString(36)}`,
        name: `${source.name} (Copy)`,
        createdAt: now,
        updatedAt: now,
        isDemoProject: false,
      };
      await saveProjectRecord(copy);
      setProjects((prev) => [copy, ...prev]);
      notify('success', `Duplicated "${source.name}"`);
    },
    [projects, notify]
  );

  const renameProject = useCallback(
    async (projectId: string, name: string, description?: string, status?: ProjectStatus) => {
      const target = projects.find((p) => p.id === projectId);
      if (!target) return;
      const updated: Project = {
        ...target,
        name: name.trim() || target.name,
        description: description !== undefined ? description : target.description,
        status: status || target.status,
        updatedAt: new Date().toISOString(),
      };
      await saveProjectRecord(updated);
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
      notify('success', `Updated project "${updated.name}"`);
    },
    [projects, notify]
  );

  const removeProject = useCallback(
    async (projectId: string) => {
      await deleteProjectRecord(projectId);
      setProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== projectId);
        if (remaining.length === 0) {
          const fallback = createBlankProject('Untitled Production', 'Fresh studio workspace');
          void saveProjectRecord(fallback);
          setActiveProjectId(fallback.id);
          void saveActiveProjectId(fallback.id);
          return [fallback];
        }
        if (activeProjectId === projectId) {
          setActiveProjectId(remaining[0].id);
          void saveActiveProjectId(remaining[0].id);
        }
        return remaining;
      });
      notify('info', 'Project deleted');
    },
    [activeProjectId, notify]
  );

  const resetDemoProject = useCallback(async () => {
    const demo = createDemoProject();
    await saveProjectRecord(demo);
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === demo.id);
      return exists ? prev.map((p) => (p.id === demo.id ? demo : p)) : [demo, ...prev];
    });
    setActiveProjectId(demo.id);
    await saveActiveProjectId(demo.id);
    notify('success', 'Restored Demo Project');
  }, [notify]);

  const updateSettings = useCallback(
    async (patch: Partial<StudioSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await saveStudioSettings(next);
    },
    [settings]
  );

  const checkComfyConnection = useCallback(
    async (overrideUrl?: string, overrideTimeoutMs?: number) => {
      const urlToTest = (overrideUrl ?? settings.comfyUiUrl).trim();
      const timeoutMs = overrideTimeoutMs ?? settings.comfyTimeoutMs;
      setComfyStatusOverride('connecting');
      try {
        const stats = await testComfyUiConnection(urlToTest, timeoutMs);
        setComfyStats(stats);
        setComfyStatusOverride(null);
        if (stats.connected) {
          try {
            const models = await fetchComfyUiModels(urlToTest, timeoutMs);
            setComfyModels(models);
          } catch {
            setComfyModels(null);
          }
          notify('success', `Connected to ComfyUI (${stats.latencyMs}ms)`);
        } else {
          setComfyModels(null);
          notify('error', stats.error || `ComfyUI status: ${stats.status}`);
        }
        return stats;
      } catch (err) {
        setComfyStatusOverride(null);
        const message = err instanceof Error ? err.message : 'ComfyUI check failed';
        notify('error', message);
        return null;
      }
    },
    [settings.comfyUiUrl, settings.comfyTimeoutMs, notify]
  );

  const checkQwenConnection = useCallback(
    async (overrideUrl?: string) => {
      const urlToTest = (overrideUrl ?? settings.qwenVlEndpointUrl).trim();
      const res = await testQwenEndpointConnection(urlToTest);
      const report: QwenConnectionReport = {
        ...res,
        checkedAt: new Date().toISOString(),
      };
      setQwenReport(report);
      if (report.connected) {
        notify('success', `Connected to Qwen2.5-VL (${report.latencyMs}ms)`);
      } else {
        notify('error', report.error || 'Qwen2.5-VL endpoint unavailable');
      }
      return report;
    },
    [settings.qwenVlEndpointUrl, notify]
  );

  // Helper to record completed ComfyUI output into project clips without overwriting existing versions
  const finalizeComfyJobOutputs = useCallback(
    (job: GenerationJob, outputs: ComfyOutputFileRef[]) => {
      updateActiveProject((proj) => {
        const existingJob = proj.jobs.find((j) => j.id === job.id);
        if (!existingJob || existingJob.status === 'completed') return proj;

        const scene = proj.scenes.find((s) => s.id === job.sceneId);
        const refAsset = scene?.referenceAssetIds[0]
          ? proj.mediaAssets.find((a) => a.id === scene.referenceAssetIds[0])
          : undefined;
        const existingClips = proj.clips.filter((c) => c.sceneId === job.sceneId);
        const nextClipVersion = existingClips.length + 1;
        const clipId = `clip_${Date.now().toString(36)}`;

        const primaryVideo = outputs.find((o) => o.mediaKind === 'video');
        const primaryImage = outputs.find((o) => o.mediaKind === 'image');
        const previewVideoUrl = primaryVideo ? buildComfyViewUrl(settings.comfyUiUrl, primaryVideo) : undefined;
        const outputImageUrl = primaryImage ? buildComfyViewUrl(settings.comfyUiUrl, primaryImage) : undefined;
        const thumb = outputImageUrl || refAsset?.thumbnailUrl || refAsset?.dataUrl || '';

        const newClip: VideoClip = {
          id: clipId,
          sceneId: job.sceneId,
          jobId: job.id,
          versionNumber: nextClipVersion,
          engine: job.engine,
          modelName: job.modelName,
          createdAt: new Date().toISOString(),
          durationSeconds: Number((job.parameters.frameCount / job.parameters.fps).toFixed(2)),
          width: job.parameters.width,
          height: job.parameters.height,
          fps: job.parameters.fps,
          seed: job.parameters.seed,
          sourceReferenceAssetId: refAsset?.id,
          previewVideoUrl,
          thumbnailUrl: thumb,
          extractedFrames: outputImageUrl ? [outputImageUrl] : refAsset ? [refAsset.dataUrl] : [],
          outputFiles: outputs,
          mode: 'comfyui_live',
          approvalState: 'technically_generated',
          qualityChecklist: {
            characterConsistency: 'unreviewed',
            facialConsistency: 'unreviewed',
            compositionPreservation: 'unreviewed',
            clothingConsistency: 'unreviewed',
            backgroundStability: 'unreviewed',
            anatomicalIntegrity: 'unreviewed',
            flickerFree: 'unreviewed',
            naturalMotion: 'unreviewed',
            noCorruption: outputs.length > 0 ? 'pass' : 'unreviewed',
          },
          qualityNotes:
            outputs.length > 0
              ? `Live ComfyUI render output (${outputs.map((o) => o.filename).join(', ')}). Ready for manual review.`
              : 'ComfyUI execution finished; no output files listed.',
        };

        return {
          ...proj,
          jobs: proj.jobs.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: 'completed',
                  progress: 100,
                  completedAt: new Date().toISOString(),
                  outputClipId: clipId,
                  outputFiles: outputs,
                }
              : j
          ),
          clips: [newClip, ...proj.clips],
          scenes: proj.scenes.map((s) => (s.id === job.sceneId ? { ...s, status: 'review' } : s)),
        };
      });
    },
    [settings.comfyUiUrl, updateActiveProject]
  );

  // Live SSE + /history fallback monitor whenever activeProject has queued/running ComfyUI jobs
  const activeComfyLiveJobs = useMemo(
    () =>
      (activeProject?.jobs || []).filter(
        (j) =>
          j.mode === 'comfyui_live' &&
          Boolean(j.comfyPromptId) &&
          (j.status === 'queued' || j.status === 'running' || j.status === 'pending')
      ),
    [activeProject?.jobs]
  );

  useEffect(() => {
    if (!activeProject || activeComfyLiveJobs.length === 0 || !settings.comfyUiUrl.trim()) {
      return;
    }

    const clientId = `ns_${activeProject.id}`;
    const unsubscribe = subscribeComfyUiEvents(settings.comfyUiUrl, clientId, (evt) => {
      if (!evt.promptId) return;
      const matchingJob = activeComfyLiveJobs.find((j) => j.comfyPromptId === evt.promptId);
      if (!matchingJob) return;

      if (evt.type === 'execution_start') {
        updateActiveProject((proj) => ({
          ...proj,
          jobs: proj.jobs.map((j) =>
            j.id === matchingJob.id
              ? { ...j, status: 'running', progress: Math.max(j.progress, 20), startedAt: j.startedAt || evt.timestamp }
              : j
          ),
        }));
      } else if (evt.type === 'executing') {
        updateActiveProject((proj) => ({
          ...proj,
          jobs: proj.jobs.map((j) =>
            j.id === matchingJob.id
              ? { ...j, status: 'running', currentNode: evt.node ?? undefined }
              : j
          ),
        }));
      } else if (evt.type === 'progress' && typeof evt.progressPercent === 'number') {
        updateActiveProject((proj) => ({
          ...proj,
          jobs: proj.jobs.map((j) =>
            j.id === matchingJob.id
              ? { ...j, status: 'running', progress: evt.progressPercent!, currentNode: evt.node ?? j.currentNode }
              : j
          ),
        }));
      } else if (evt.type === 'execution_error') {
        updateActiveProject((proj) => ({
          ...proj,
          jobs: proj.jobs.map((j) =>
            j.id === matchingJob.id
              ? {
                  ...j,
                  status: 'failed',
                  progress: 0,
                  completedAt: evt.timestamp,
                  errorMessage: evt.message || 'ComfyUI execution failed.',
                }
              : j
          ),
        }));
        notify('error', evt.message || 'ComfyUI execution failed');
      } else if (evt.type === 'execution_interrupted') {
        updateActiveProject((proj) => ({
          ...proj,
          jobs: proj.jobs.map((j) =>
            j.id === matchingJob.id
              ? {
                  ...j,
                  status: 'interrupted',
                  completedAt: evt.timestamp,
                  errorMessage: 'Execution interrupted on ComfyUI server.',
                }
              : j
          ),
        }));
        notify('info', 'ComfyUI job interrupted');
      } else if (evt.type === 'executed') {
        void fetchComfyUiHistory(settings.comfyUiUrl, matchingJob.comfyPromptId!, settings.comfyTimeoutMs)
          .then((res) => {
            if (res.parsed.completed) {
              finalizeComfyJobOutputs(matchingJob, res.parsed.outputs);
              notify('success', `ComfyUI job completed (${res.parsed.outputs.length} output file(s))`);
            }
          })
          .catch(() => {
            // Poll loop will retry
          });
      }
    });

    const pollInterval = window.setInterval(() => {
      for (const job of activeComfyLiveJobs) {
        if (!job.comfyPromptId) continue;
        void fetchComfyUiHistory(settings.comfyUiUrl, job.comfyPromptId, settings.comfyTimeoutMs)
          .then((res) => {
            if (res.parsed.completed) {
              finalizeComfyJobOutputs(job, res.parsed.outputs);
              notify('success', `ComfyUI job completed (${res.parsed.outputs.length} output file(s))`);
            } else if (res.parsed.statusStr === 'error') {
              updateActiveProject((proj) => ({
                ...proj,
                jobs: proj.jobs.map((j) =>
                  j.id === job.id
                    ? { ...j, status: 'failed', completedAt: new Date().toISOString(), errorMessage: 'ComfyUI reported execution error in history.' }
                    : j
                ),
              }));
            }
          })
          .catch(() => {
            // Silent retry on next tick
          });
      }
    }, 3000);

    return () => {
      unsubscribe();
      window.clearInterval(pollInterval);
    };
  }, [
    activeProject,
    activeComfyLiveJobs,
    settings.comfyUiUrl,
    settings.comfyTimeoutMs,
    updateActiveProject,
    finalizeComfyJobOutputs,
    notify,
  ]);

  // Media Ingestion
  const uploadMedia = useCallback(
    async (files: FileList | File[], category: AssetCategory): Promise<IngestionReport | null> => {
      if (!activeProject) return null;
      const existingHashes = new Set(activeProject.mediaAssets.map((a) => a.sha256));
      const report = await ingestMediaFiles(files, activeProject.id, existingHashes, category);
      if (report.added.length > 0) {
        updateActiveProject((proj) => ({
          ...proj,
          mediaAssets: [...report.added, ...proj.mediaAssets],
        }));
      }
      if (report.added.length > 0) {
        notify(
          'success',
          `Added ${report.added.length} asset(s)${
            report.duplicates.length > 0 ? ` · Skipped ${report.duplicates.length} duplicate(s)` : ''
          }`
        );
      } else if (report.duplicates.length > 0) {
        notify('info', `Skipped ${report.duplicates.length} duplicate file(s)`);
      } else if (report.skipped.length > 0) {
        notify('error', report.skipped[0]);
      }
      return report;
    },
    [activeProject, updateActiveProject, notify]
  );

  // AI Image Intelligence (with sha256 + provider + model cache check)
  const analyzeAsset = useCallback(
    async (
      assetId: string,
      provider: VisionProviderId,
      options?: { forceRefresh?: boolean }
    ): Promise<ImageAnalysis | null> => {
      if (!activeProject) return null;
      const asset = activeProject.mediaAssets.find((a) => a.id === assetId);
      if (!asset) return null;

      const targetModel = provider === 'qwen-vl' ? settings.qwenVlModelId : settings.geminiModel;
      const cached = activeProject.analyses[assetId];
      if (
        !options?.forceRefresh &&
        cached &&
        cached.provider === provider &&
        cached.modelName === targetModel &&
        cached.assetSha256 === asset.sha256
      ) {
        notify('info', `Using cached ${targetModel} analysis for ${asset.fileName}`);
        return cached;
      }

      const { base64, mimeType } = await urlToBase64(asset.dataUrl);
      let analysis: ImageAnalysis;

      if (provider === 'qwen-vl') {
        if (!settings.qwenVlEndpointUrl.trim() && !backendHealth?.qwenEnvUrlConfigured) {
          throw new Error('Configure an external Qwen2.5-VL inference endpoint URL in Settings first.');
        }
        analysis = await analyzeImageViaQwen({
          endpointUrl: settings.qwenVlEndpointUrl,
          modelId: settings.qwenVlModelId,
          assetId,
          base64Data: base64,
          mimeType,
        });
      } else {
        analysis = await analyzeImageViaGemini({
          assetId,
          base64Data: base64,
          mimeType,
          fileName: asset.fileName,
          model: settings.geminiModel,
        });
      }

      const stamped: ImageAnalysis = { ...analysis, assetSha256: asset.sha256 };
      updateActiveProject((proj) => ({
        ...proj,
        analyses: { ...proj.analyses, [assetId]: stamped },
      }));
      notify('success', `Analyzed ${asset.fileName} via ${stamped.modelName}`);
      return stamped;
    },
    [
      activeProject,
      settings.qwenVlEndpointUrl,
      settings.qwenVlModelId,
      settings.geminiModel,
      backendHealth?.qwenEnvUrlConfigured,
      updateActiveProject,
      notify,
    ]
  );

  const saveAnalysisCorrection = useCallback(
    (assetId: string, updated: ImageAnalysis) => {
      updateActiveProject((proj) => ({
        ...proj,
        analyses: {
          ...proj.analyses,
          [assetId]: { ...updated, userEdited: true },
        },
      }));
      notify('success', 'Saved manual analysis corrections');
    },
    [updateActiveProject, notify]
  );

  // Character Bible
  const upsertCharacter = useCallback(
    (char: CharacterEntry) => {
      updateActiveProject((proj) => {
        const exists = proj.characters.some((c) => c.id === char.id);
        return {
          ...proj,
          characters: exists
            ? proj.characters.map((c) => (c.id === char.id ? char : c))
            : [...proj.characters, char],
        };
      });
    },
    [updateActiveProject]
  );

  const replaceCharacters = useCallback(
    (nextChars: CharacterEntry[]) => {
      updateActiveProject((proj) => ({ ...proj, characters: nextChars }));
    },
    [updateActiveProject]
  );

  const deleteCharacter = useCallback(
    (characterId: string) => {
      updateActiveProject((proj) => ({
        ...proj,
        characters: proj.characters.filter((c) => c.id !== characterId),
        scenes: proj.scenes.map((s) => ({
          ...s,
          characterIds: s.characterIds.filter((id) => id !== characterId),
        })),
        costumes: (proj.costumes || []).filter((co) => co.characterId !== characterId),
        props: (proj.props || []).map((p) => ({
          ...p,
          characterIds: p.characterIds.filter((id) => id !== characterId),
        })),
      }));
      notify('info', 'Removed character from Character Bible');
    },
    [notify, updateActiveProject]
  );

  // Scene Planner
  const addScene = useCallback(
    (scenePatch?: Partial<ScenePlan>) => {
      if (!activeProject) return;
      const engine = scenePatch?.selectedEngine || activeProject.settings.defaultEngine;
      const nextOrder = activeProject.scenes.length + 1;
      const newScene: ScenePlan = {
        id: `scene_${Date.now().toString(36)}`,
        order: nextOrder,
        title: scenePatch?.title || `${String(nextOrder).padStart(2, '0')}. New Scene`,
        description: scenePatch?.description || 'Describe visual action, subject expression, and atmospheric mood.',
        referenceAssetIds: scenePatch?.referenceAssetIds || [],
        characterIds: scenePatch?.characterIds || [],
        environmentDescription: scenePatch?.environmentDescription || 'Evening urban setting',
        composition: scenePatch?.composition || 'Balanced medium framing',
        cameraFraming: scenePatch?.cameraFraming || 'Medium Shot',
        lighting: scenePatch?.lighting || 'Natural key light with soft fill',
        motionDirection: scenePatch?.motionDirection || 'Subtle natural subject movement',
        cameraMovement: scenePatch?.cameraMovement || 'Slow dolly push-in',
        durationSeconds: scenePatch?.durationSeconds || 4,
        narrativePurpose: scenePatch?.narrativePurpose || 'Visual beat',
        positivePrompt: scenePatch?.positivePrompt || '',
        negativePrompt: scenePatch?.negativePrompt || '',
        selectedEngine: engine,
        generationSettings: { ...ENGINE_REGISTRY[engine].defaultParams },
        status: 'planned',
        approvedForGeneration: false,
        ...scenePatch,
      };

      updateActiveProject((proj) => ({
        ...proj,
        scenes: [...proj.scenes, newScene],
      }));
      notify('success', `Added "${newScene.title}"`);
    },
    [activeProject, updateActiveProject, notify]
  );

  const updateScene = useCallback(
    (sceneId: string, updater: (scene: ScenePlan) => ScenePlan) => {
      updateActiveProject((proj) => ({
        ...proj,
        scenes: proj.scenes.map((s) => (s.id === sceneId ? updater(s) : s)),
      }));
    },
    [updateActiveProject]
  );

  const reorderScene = useCallback(
    (sceneId: string, direction: 'up' | 'down') => {
      updateActiveProject((proj) => {
        const sorted = proj.scenes.slice().sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((s) => s.id === sceneId);
        if (idx === -1) return proj;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return proj;
        const temp = sorted[idx];
        sorted[idx] = sorted[swapIdx];
        sorted[swapIdx] = temp;
        return {
          ...proj,
          scenes: sorted.map((s, i) => ({ ...s, order: i + 1 })),
        };
      });
    },
    [updateActiveProject]
  );

  const generateAiScenesForProject = useCallback(async () => {
    if (!activeProject) return;
    const assetsSummary = activeProject.mediaAssets.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      description: activeProject.analyses[a.id]?.description || a.fileName,
    }));
    const charactersSummary = activeProject.characters.map((c) => ({
      id: c.id,
      name: c.name,
      appearance: `${c.hairstyle}, ${c.clothing}, ${c.distinguishingCharacteristics}`,
    }));
    const lyricsExcerpt = activeProject.lyrics.map((l) => l.text).join('\n');

    const res = await generateAiScenePlan({
      projectName: activeProject.name,
      projectDescription: activeProject.description,
      assetsSummary,
      charactersSummary,
      lyricsExcerpt,
      model: settings.geminiModel,
    });

    const created: ScenePlan[] = (res.scenes || []).map((raw, i) => {
      const order = activeProject.scenes.length + i + 1;
      const engine = activeProject.settings.defaultEngine;
      return {
        id: `scene_ai_${Date.now().toString(36)}_${i}`,
        order,
        title: String(raw.title || `${String(order).padStart(2, '0')}. AI Scene`),
        description: String(raw.description || ''),
        referenceAssetIds: Array.isArray(raw.referenceAssetIds) ? (raw.referenceAssetIds as string[]) : [],
        characterIds: Array.isArray(raw.characterIds) ? (raw.characterIds as string[]) : [],
        environmentDescription: String(raw.environmentDescription || ''),
        composition: String(raw.composition || ''),
        cameraFraming: String(raw.cameraFraming || 'Medium Shot'),
        lighting: String(raw.lighting || ''),
        motionDirection: String(raw.motionDirection || ''),
        cameraMovement: String(raw.cameraMovement || ''),
        durationSeconds: Number(raw.durationSeconds || 4),
        narrativePurpose: String(raw.narrativePurpose || ''),
        positivePrompt: '',
        negativePrompt: '',
        selectedEngine: engine,
        generationSettings: { ...ENGINE_REGISTRY[engine].defaultParams },
        status: 'planned',
        aiGenerated: true,
        approvedForGeneration: false,
      };
    });

    updateActiveProject((proj) => ({
      ...proj,
      scenes: [...proj.scenes, ...created],
    }));
    notify('success', `Generated ${created.length} AI scene plan(s) for review`);
  }, [activeProject, settings.geminiModel, updateActiveProject, notify]);

  // Prompt Studio
  const compileAndSavePrompt = useCallback(
    async (
      sceneId: string,
      engine: EngineId,
      options: {
        useAi?: boolean;
        userNotes?: string;
        overridePositive?: string;
        overrideNegative?: string;
      }
    ) => {
      if (!activeProject) return null;
      const scene = activeProject.scenes.find((s) => s.id === sceneId);
      if (!scene) return null;

      const analyses = scene.referenceAssetIds
        .map((id) => activeProject.analyses[id])
        .filter((a): a is ImageAnalysis => Boolean(a));

      const compiled = compileStructuredPrompt({
        scene,
        characters: activeProject.characters,
        analyses,
        engine,
      });

      let positivePrompt = options.overridePositive ?? compiled.positivePrompt;
      let negativePrompt = options.overrideNegative ?? compiled.negativePrompt;

      if (options.useAi) {
        const aiOut = await synthesizeAiPrompt({
          engine,
          sceneTitle: scene.title,
          sceneDescription: scene.description,
          characterInstructions: compiled.characterConsistencyBlock,
          userNotes: options.userNotes || '',
          model: settings.geminiModel,
        });
        if (aiOut.positivePrompt) positivePrompt = aiOut.positivePrompt;
        if (aiOut.negativePrompt) negativePrompt = aiOut.negativePrompt;
      }

      const existingForSceneEngine = activeProject.promptHistory.filter(
        (p) => p.sceneId === sceneId && p.engine === engine
      );
      const nextVersionNum = existingForSceneEngine.length + 1;

      const entry: PromptVersion = {
        id: `pv_${Date.now().toString(36)}`,
        sceneId,
        engine,
        version: nextVersionNum,
        createdAt: new Date().toISOString(),
        positivePrompt,
        negativePrompt,
        characterConsistencyBlock: compiled.characterConsistencyBlock,
        sceneConsistencyBlock: compiled.sceneConsistencyBlock,
        cameraMovementBlock: compiled.cameraMovementBlock,
        motionBlock: compiled.motionBlock,
        lightingBlock: compiled.lightingBlock,
        styleBlock: compiled.styleBlock,
        estimatedTokens: estimatePromptTokens(positivePrompt) + estimatePromptTokens(negativePrompt),
        notes: options.userNotes,
      };

      updateActiveProject((proj) => ({
        ...proj,
        promptHistory: [entry, ...proj.promptHistory],
        scenes: proj.scenes.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                selectedEngine: engine,
                positivePrompt,
                negativePrompt,
                status: s.status === 'planned' ? 'prompt_ready' : s.status,
              }
            : s
        ),
      }));
      notify('success', `Saved Prompt v${nextVersionNum} for ${ENGINE_REGISTRY[engine].name}`);
      return entry;
    },
    [activeProject, settings.geminiModel, updateActiveProject, notify]
  );

  // Generation Studio & Queue
  const submitGenerationJob = useCallback(
    async (input: {
      sceneId: string;
      params: GenerationParameters;
      positivePrompt: string;
      negativePrompt: string;
      workflowId?: string;
      mode: 'comfyui_live' | 'offline_simulation';
    }) => {
      if (!activeProject) return null;
      const validation = validateGenerationParams(input.params);
      if (!validation.valid) {
        notify('error', validation.errors[0]);
        return null;
      }

      const scene = activeProject.scenes.find((s) => s.id === input.sceneId);
      const template =
        activeProject.workflows.find((w) => w.id === input.workflowId) ||
        activeProject.workflows.find((w) => w.engine === input.params.engine) ||
        activeProject.workflows[0];

      const refAsset = scene?.referenceAssetIds[0]
        ? activeProject.mediaAssets.find((a) => a.id === scene.referenceAssetIds[0])
        : undefined;

      const jobId = `job_${Date.now().toString(36)}`;
      const baseWorkflow = template
        ? injectSceneIntoWorkflow(template.json, {
            positivePrompt: input.positivePrompt,
            negativePrompt: input.negativePrompt,
            params: input.params,
            imageFilename: refAsset?.fileName,
          })
        : undefined;

      const baseJob: GenerationJob = {
        id: jobId,
        projectId: activeProject.id,
        sceneId: input.sceneId,
        engine: input.params.engine,
        modelName: input.params.modelName,
        workflowId: template?.id,
        status: input.mode === 'comfyui_live' ? 'submitting' : 'running',
        mode: input.mode,
        progress: input.mode === 'offline_simulation' ? 35 : 5,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        workflowJson: baseWorkflow,
        parameters: input.params,
        positivePrompt: input.positivePrompt,
        negativePrompt: input.negativePrompt,
      };

      if (input.mode === 'comfyui_live') {
        if (!comfyStats?.connected) {
          const failedJob: GenerationJob = {
            ...baseJob,
            status: 'failed',
            progress: 0,
            completedAt: new Date().toISOString(),
            errorMessage: 'ComfyUI server is not connected. Configure URL and test connection in Settings.',
          };
          updateActiveProject((proj) => ({ ...proj, jobs: [failedJob, ...proj.jobs] }));
          notify('error', failedJob.errorMessage!);
          return failedJob;
        }

        const wfCheck = baseWorkflow ? validateComfyWorkflowJson(baseWorkflow) : null;
        if (!baseWorkflow || !wfCheck?.valid) {
          const failedJob: GenerationJob = {
            ...baseJob,
            status: 'failed',
            progress: 0,
            completedAt: new Date().toISOString(),
            errorMessage: wfCheck?.errors[0] || 'Workflow JSON validation failed before submission.',
          };
          updateActiveProject((proj) => ({ ...proj, jobs: [failedJob, ...proj.jobs] }));
          notify('error', failedJob.errorMessage!);
          return failedJob;
        }

        updateActiveProject((proj) => ({ ...proj, jobs: [baseJob, ...proj.jobs] }));

        try {
          let uploadedImageName: string | undefined;
          let finalWorkflow = baseWorkflow;

          // Step 1: Upload reference image to ComfyUI /upload/image if LoadImage node is present
          if (wfCheck.hasLoadImage && refAsset) {
            const { base64, mimeType } = await urlToBase64(refAsset.dataUrl);
            const uploadRes = await uploadImageToComfyUi({
              url: settings.comfyUiUrl,
              fileName: refAsset.fileName,
              mimeType,
              base64Data: base64,
              timeoutMs: settings.comfyTimeoutMs,
            });
            uploadedImageName = uploadRes.subfolder
              ? `${uploadRes.subfolder}/${uploadRes.name}`
              : uploadRes.name;
            finalWorkflow = injectSceneIntoWorkflow(baseWorkflow, {
              positivePrompt: input.positivePrompt,
              negativePrompt: input.negativePrompt,
              params: input.params,
              imageFilename: uploadedImageName,
            });
          }

          // Step 2: Submit compiled workflow API JSON to /prompt
          const response = await submitComfyUiWorkflow(
            settings.comfyUiUrl,
            finalWorkflow,
            `ns_${activeProject.id}`,
            settings.comfyTimeoutMs
          );

          const queuedJob: GenerationJob = {
            ...baseJob,
            status: 'queued',
            progress: 15,
            submittedAt: new Date().toISOString(),
            comfyPromptId: response.prompt_id,
            uploadedImageName,
            workflowJson: finalWorkflow,
          };
          updateActiveProject((proj) => ({
            ...proj,
            jobs: proj.jobs.map((j) => (j.id === jobId ? queuedJob : j)),
          }));
          notify('success', `Queued live job on ComfyUI (${response.prompt_id})`);
          return queuedJob;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'ComfyUI submission failed';
          const failedJob: GenerationJob = {
            ...baseJob,
            status: 'failed',
            progress: 0,
            completedAt: new Date().toISOString(),
            errorMessage: message,
          };
          updateActiveProject((proj) => ({
            ...proj,
            jobs: proj.jobs.map((j) => (j.id === jobId ? failedJob : j)),
          }));
          notify('error', message);
          return failedJob;
        }
      }

      // Offline Simulation Mode (explicitly labeled as simulation, never overwriting previous versions)
      updateActiveProject((proj) => ({ ...proj, jobs: [baseJob, ...proj.jobs] }));

      window.setTimeout(() => {
        const existingClipsForScene = activeProject.clips.filter((c) => c.sceneId === input.sceneId);
        const nextClipVersion = existingClipsForScene.length + 1;
        const clipId = `clip_${Date.now().toString(36)}`;
        const refThumb = refAsset?.thumbnailUrl || refAsset?.dataUrl || '';

        const newClip: VideoClip = {
          id: clipId,
          sceneId: input.sceneId,
          jobId,
          versionNumber: nextClipVersion,
          engine: input.params.engine,
          modelName: input.params.modelName,
          createdAt: new Date().toISOString(),
          durationSeconds: Number((input.params.frameCount / input.params.fps).toFixed(2)),
          width: input.params.width,
          height: input.params.height,
          fps: input.params.fps,
          seed: input.params.seed,
          sourceReferenceAssetId: refAsset?.id,
          thumbnailUrl: refThumb,
          extractedFrames: refThumb ? [refThumb, refThumb, refThumb] : [],
          mode: 'offline_simulation',
          approvalState: 'technically_generated',
          qualityChecklist: {
            characterConsistency: 'unreviewed',
            facialConsistency: 'unreviewed',
            compositionPreservation: 'unreviewed',
            clothingConsistency: 'unreviewed',
            backgroundStability: 'unreviewed',
            anatomicalIntegrity: 'unreviewed',
            flickerFree: 'unreviewed',
            naturalMotion: 'unreviewed',
            noCorruption: 'pass',
          },
          qualityNotes: 'Simulated pipeline output (no GPU connected). Ready for manual review.',
        };

        updateActiveProject((proj) => ({
          ...proj,
          jobs: proj.jobs.map((j) =>
            j.id === jobId
              ? { ...j, status: 'completed', progress: 100, completedAt: new Date().toISOString(), outputClipId: clipId }
              : j
          ),
          clips: [newClip, ...proj.clips],
          scenes: proj.scenes.map((s) => (s.id === input.sceneId ? { ...s, status: 'review' } : s)),
        }));
        notify('success', `Simulated clip v${nextClipVersion} completed (Offline Test Mode)`);
      }, 900);

      return baseJob;
    },
    [activeProject, comfyStats, settings.comfyUiUrl, settings.comfyTimeoutMs, updateActiveProject, notify]
  );

  const retryJob = useCallback(
    async (jobId: string) => {
      const target = activeProject?.jobs.find((j) => j.id === jobId);
      if (!target) return null;
      return submitGenerationJob({
        sceneId: target.sceneId,
        params: target.parameters,
        positivePrompt: target.positivePrompt,
        negativePrompt: target.negativePrompt,
        workflowId: target.workflowId,
        mode: target.mode,
      });
    },
    [activeProject?.jobs, submitGenerationJob]
  );

  const cancelJob = useCallback(
    async (jobId: string) => {
      const job = activeProject?.jobs.find((j) => j.id === jobId);
      if (job?.mode === 'comfyui_live' && comfyStats?.connected) {
        try {
          await interruptComfyUi(settings.comfyUiUrl);
        } catch {
          // Best effort interrupt
        }
      }
      updateActiveProject((proj) => ({
        ...proj,
        jobs: proj.jobs.map((j) =>
          j.id === jobId && (j.status === 'pending' || j.status === 'submitting' || j.status === 'queued' || j.status === 'running')
            ? { ...j, status: 'cancelled', completedAt: new Date().toISOString() }
            : j
        ),
      }));
      notify('info', 'Job marked cancelled');
    },
    [activeProject, comfyStats, settings.comfyUiUrl, updateActiveProject, notify]
  );

  const runComfyE2ETest = useCallback(async () => {
    const start = Date.now();
    if (!comfyStats?.connected) {
      const res: ComfyE2EDiagnosticResult = {
        ranAt: new Date().toISOString(),
        success: false,
        durationMs: Date.now() - start,
        error: 'ComfyUI server is not connected. Test connection first.',
      };
      setComfyE2EResult(res);
      notify('error', res.error!);
      return res;
    }

    const ckpt = comfyModels?.checkpoints[0];
    if (!ckpt) {
      const res: ComfyE2EDiagnosticResult = {
        ranAt: new Date().toISOString(),
        success: false,
        durationMs: Date.now() - start,
        error: 'No checkpoints found in ComfyUI /object_info. Install at least one checkpoint to run live E2E generation.',
      };
      setComfyE2EResult(res);
      notify('error', res.error!);
      return res;
    }

    try {
      const wf = buildComfyE2ETestWorkflow(ckpt);
      const submitted = await submitComfyUiWorkflow(
        settings.comfyUiUrl,
        wf,
        `ns_e2e_${Date.now().toString(36)}`,
        settings.comfyTimeoutMs
      );

      let outputImageUrl: string | undefined;
      for (let i = 0; i < 20; i += 1) {
        await new Promise((r) => setTimeout(r, 1500));
        const hist = await fetchComfyUiHistory(settings.comfyUiUrl, submitted.prompt_id, settings.comfyTimeoutMs);
        if (hist.parsed.completed) {
          const img = hist.parsed.outputs.find((o) => o.mediaKind === 'image') || hist.parsed.outputs[0];
          if (img) outputImageUrl = buildComfyViewUrl(settings.comfyUiUrl, img);
          break;
        }
      }

      const res: ComfyE2EDiagnosticResult = {
        ranAt: new Date().toISOString(),
        success: Boolean(outputImageUrl),
        checkpointUsed: ckpt,
        promptId: submitted.prompt_id,
        durationMs: Date.now() - start,
        outputImageUrl,
        error: outputImageUrl ? undefined : 'Timed out waiting for ComfyUI E2E test output in /history.',
      };
      setComfyE2EResult(res);
      if (res.success) notify('success', `ComfyUI E2E test succeeded (${res.durationMs}ms)`);
      else notify('error', res.error!);
      return res;
    } catch (err) {
      const res: ComfyE2EDiagnosticResult = {
        ranAt: new Date().toISOString(),
        success: false,
        checkpointUsed: ckpt,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'ComfyUI E2E test failed',
      };
      setComfyE2EResult(res);
      notify('error', res.error!);
      return res;
    }
  }, [comfyStats?.connected, comfyModels, settings.comfyUiUrl, settings.comfyTimeoutMs, notify]);

  const updateClipQuality = useCallback(
    (
      clipId: string,
      patch: {
        approvalState?: ClipApprovalState;
        qualityChecklist?: QualityChecklist;
        qualityNotes?: string;
      }
    ) => {
      updateActiveProject((proj) => ({
        ...proj,
        clips: proj.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
      }));
      notify('success', 'Updated clip quality review');
    },
    [updateActiveProject, notify]
  );

  const addClipToTimeline = useCallback(
    (clip: VideoClip) => {
      if (!activeProject) return;
      const scene = activeProject.scenes.find((s) => s.id === clip.sceneId);
      const currentTotal = activeProject.timeline.blocks.reduce((sum, b) => sum + b.durationSec, 0);
      const newBlock: TimelineBlock = {
        id: `blk_${Date.now().toString(36)}`,
        sceneId: clip.sceneId,
        clipId: clip.id,
        title: `${scene?.title || 'Clip'} (v${clip.versionNumber})`,
        startTimeSec: Number(currentTotal.toFixed(2)),
        durationSec: Math.max(1, Number(clip.durationSeconds.toFixed(2))),
        trimStartSec: 0,
        trimEndSec: Math.max(1, Number(clip.durationSeconds.toFixed(2))),
        transitionIn: 'crossfade',
        transitionDurationSec: 0.4,
      };
      updateActiveProject((proj) => ({
        ...proj,
        timeline: {
          ...proj.timeline,
          blocks: [...proj.timeline.blocks, newBlock],
        },
      }));
      notify('success', `Added "${newBlock.title}" to Video Timeline`);
    },
    [activeProject, updateActiveProject, notify]
  );

  // Server FFmpeg MP4 Render
  const startServerMp4Render = useCallback(async () => {
    if (!activeProject) return null;
    const blocks = activeProject.timeline.blocks;
    const segments =
      blocks.length > 0
        ? blocks.map((b) => {
            const clip = activeProject.clips.find((c) => c.id === b.clipId);
            const scene = activeProject.scenes.find((s) => s.id === b.sceneId);
            const ref = scene?.referenceAssetIds[0]
              ? activeProject.mediaAssets.find((a) => a.id === scene.referenceAssetIds[0])
              : undefined;
            const img = clip?.thumbnailUrl || ref?.dataUrl;
            const vid = clip?.previewVideoUrl?.startsWith('data:') ? clip.previewVideoUrl : undefined;
            return {
              title: b.title,
              durationSec: b.durationSec,
              videoDataUrl: vid,
              imageDataUrl: img,
            };
          })
        : activeProject.scenes.map((s) => {
            const ref = s.referenceAssetIds[0]
              ? activeProject.mediaAssets.find((a) => a.id === s.referenceAssetIds[0])
              : undefined;
            return {
              title: s.title,
              durationSec: s.durationSeconds,
              imageDataUrl: ref?.dataUrl,
            };
          });

    if (segments.length === 0) {
      notify('error', 'Add at least one scene or timeline block before rendering MP4.');
      return null;
    }

    const job = await createServerRenderJob({
      projectId: activeProject.id,
      projectName: activeProject.name,
      segments,
      exportSettings: activeProject.exportSettings,
      audioDataUrl: activeProject.musicAsset?.dataUrl,
      audioFileName: activeProject.musicAsset?.fileName,
      lyrics: activeProject.lyrics,
    });
    setActiveRenderJob(job);
    notify('info', 'Started server-side FFmpeg MP4 render...');

    const poll = window.setInterval(() => {
      void fetchServerRenderJob(job.id)
        .then((latest) => {
          setActiveRenderJob(latest);
          if (latest.status === 'completed') {
            window.clearInterval(poll);
            notify('success', `MP4 render ready: ${latest.outputFileName}`);
          } else if (latest.status === 'failed') {
            window.clearInterval(poll);
            notify('error', latest.errorMessage || 'FFmpeg render failed');
          }
        })
        .catch(() => {
          window.clearInterval(poll);
        });
    }, 1000);

    return job;
  }, [activeProject, notify]);

  // Portable Project Export / Import
  const exportCurrentProjectZip = useCallback(async () => {
    if (!activeProject) return;
    const blob = await exportProjectToZipBlob(activeProject);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProject.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.nss.zip`;
    link.click();
    URL.revokeObjectURL(url);
    notify('success', `Exported portable archive for "${activeProject.name}"`);
  }, [activeProject, notify]);

  const importProjectZip = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer();
      const result = await importProjectFromZipBuffer(buffer);
      if (!result.valid || !result.project) {
        notify('error', result.errors[0] || 'Invalid project ZIP');
        return;
      }
      const imported: Project = {
        ...result.project,
        id: projects.some((p) => p.id === result.project!.id)
          ? `proj_${Date.now().toString(36)}`
          : result.project.id,
        updatedAt: new Date().toISOString(),
      };
      await saveProjectRecord(imported);
      await saveActiveProjectId(imported.id);
      setProjects((prev) => [imported, ...prev]);
      setActiveProjectId(imported.id);
      notify('success', `Imported project "${imported.name}"`);
    },
    [projects, notify]
  );

  const ltxCapability = useMemo(
    () => inspectEngineCapabilities('ltx-video', comfyModels),
    [comfyModels]
  );
  const wanCapability = useMemo(
    () => inspectEngineCapabilities('wan-2.1', comfyModels),
    [comfyModels]
  );

  // Model catalog grounded in actual connected ComfyUI + configured server capabilities
  const modelCatalog = useMemo<ModelCatalogEntry[]>(() => {
    const base: ModelCatalogEntry[] = [
      {
        id: 'model_gemini_primary',
        name: settings.geminiModel || 'gemini-4-hydrogen',
        category: 'image_understanding',
        provider: 'Google GenAI (Server Proxy)',
        version: settings.geminiModel || 'gemini-4-hydrogen',
        requiredEngine: 'Server-Side Gemini API',
        status: backendHealth?.geminiConfigured ? 'configured' : 'unavailable',
        source: 'server_env',
        notes: backendHealth?.geminiConfigured
          ? 'Configured via server GEMINI_API_KEY'
          : 'GEMINI_API_KEY not detected on server',
      },
      {
        id: 'model_qwen25_vl',
        name: settings.qwenVlModelId || 'Qwen/Qwen2.5-VL-3B-Instruct',
        category: 'image_understanding',
        provider: 'External OpenAI-Compatible Endpoint',
        version: 'Qwen2.5-VL-3B-Instruct',
        requiredEngine: 'Vision Provider Proxy',
        status: qwenReport?.connected
          ? 'installed'
          : settings.qwenVlEndpointUrl.trim() || backendHealth?.qwenEnvUrlConfigured
          ? 'configured'
          : 'not_connected',
        source: qwenReport?.connected ? 'comfyui_live' : 'manual_config',
        notes: qwenReport?.connected
          ? `Verified live (${qwenReport.latencyMs}ms)`
          : settings.qwenVlEndpointUrl.trim()
          ? `Endpoint: ${settings.qwenVlEndpointUrl}`
          : 'Set external inference URL in Settings',
      },
      {
        id: 'model_ltx_095',
        name: 'Lightricks/LTX-Video-0.9.5',
        category: 'video_generation',
        provider: 'Lightricks (via ComfyUI)',
        version: '0.9.5',
        requiredEngine: 'ltx-video',
        status: !comfyStats?.connected
          ? 'not_connected'
          : ltxCapability.ready
          ? 'installed'
          : 'unavailable',
        source: comfyStats?.connected ? 'comfyui_live' : 'manual_config',
        notes: comfyStats?.connected
          ? ltxCapability.ready
            ? 'All LTX-Video 0.9.5 nodes and checkpoints verified'
            : `Missing: ${[...ltxCapability.missingNodes, ...ltxCapability.missingModels].join(', ')}`
          : 'Connect ComfyUI server to verify nodes and checkpoints',
      },
      {
        id: 'model_wan_21',
        name: 'Wan2.1-I2V-14B-480P',
        category: 'video_generation',
        provider: 'Alibaba Wan (via ComfyUI)',
        version: '2.1',
        requiredEngine: 'wan-2.1',
        status: !comfyStats?.connected
          ? 'not_connected'
          : wanCapability.ready
          ? 'installed'
          : 'unavailable',
        source: comfyStats?.connected ? 'comfyui_live' : 'manual_config',
        notes: comfyStats?.connected
          ? wanCapability.ready
            ? 'All Wan 2.1 nodes and UNET/checkpoints verified'
            : `Missing: ${[...wanCapability.missingNodes, ...wanCapability.missingModels].join(', ')}`
          : 'Connect ComfyUI server to verify Wan UNET and nodes',
      },
    ];

    if (comfyModels) {
      comfyModels.checkpoints.forEach((ckpt, idx) => {
        base.push({
          id: `comfy_ckpt_${idx}`,
          name: ckpt,
          category:
            ckpt.toLowerCase().includes('video') || ckpt.toLowerCase().includes('svd')
              ? 'video_generation'
              : 'image_generation',
          provider: 'ComfyUI Checkpoints',
          version: 'Local Checkpoint',
          requiredEngine: 'comfyui',
          status: 'installed',
          source: 'comfyui_live',
        });
      });
    }

    return base;
  }, [
    backendHealth,
    comfyModels,
    comfyStats,
    ltxCapability,
    wanCapability,
    qwenReport,
    settings.geminiModel,
    settings.qwenVlEndpointUrl,
    settings.qwenVlModelId,
  ]);

  const setLyrics = useCallback(
    (lyrics: LyricLine[]) => {
      updateActiveProject((proj) => ({ ...proj, lyrics }));
    },
    [updateActiveProject]
  );

  // AI Orchestration Actions
  const aiProviders = useMemo(
    () => (settings.aiProviders?.length ? settings.aiProviders : DEFAULT_AI_PROVIDERS),
    [settings.aiProviders]
  );
  const aiModels = useMemo(
    () => (settings.aiModels?.length ? settings.aiModels : DEFAULT_AI_MODELS),
    [settings.aiModels]
  );
  const routingRules = useMemo(
    () => (settings.routingRules?.length ? settings.routingRules : DEFAULT_TASK_ROUTING_RULES),
    [settings.routingRules]
  );

  const refreshProviderCredentials = useCallback(async () => {
    const creds = await fetchProviderCredentialsStatus(aiProviders);
    setProviderCredentials(creds);
    return creds;
  }, [aiProviders]);

  const saveProviderSecret = useCallback(
    async (providerId: string, apiKey: string) => {
      const status = await saveProviderSessionCredential(providerId, apiKey);
      setProviderCredentials((prev) => ({ ...prev, [providerId]: status }));
      notify(
        'success',
        status.hasCredential
          ? `Stored server-side session credential for ${providerId}`
          : `Cleared session credential for ${providerId}`
      );
      return status;
    },
    [notify]
  );

  const probeAiProvider = useCallback(
    async (provider: AIProviderConfig) => {
      const result = await testAiProvider(provider, settings.comfyTimeoutMs || 10000);
      setProviderProbes((prev) => ({
        ...prev,
        [provider.id]: {
          connected: result.connected,
          checkedAt: result.checkedAt,
          latencyMs: result.latencyMs,
          error: result.error,
          discoveredModels: result.discoveredModels,
        },
      }));
      if (result.connected && result.discoveredModels.length > 0) {
        const nextProviders = aiProviders.map((p) =>
          p.id === provider.id
            ? {
                ...p,
                availableModels: Array.from(new Set([...p.availableModels, ...result.discoveredModels])),
              }
            : p
        );
        await updateSettings({ aiProviders: nextProviders });
      }
      if (result.connected) {
        notify('success', `${provider.name} connected (${result.latencyMs ?? 0}ms)`);
      } else {
        notify('error', result.error || `${provider.name}: ${result.status}`);
      }
      return result;
    },
    [aiProviders, notify, settings.comfyTimeoutMs, updateSettings]
  );

  const upsertAiProvider = useCallback(
    async (provider: AIProviderConfig) => {
      const exists = aiProviders.some((p) => p.id === provider.id);
      const next = exists
        ? aiProviders.map((p) => (p.id === provider.id ? provider : p))
        : [...aiProviders, provider];
      await updateSettings({ aiProviders: next });
      await refreshProviderCredentials().catch(() => undefined);
      notify('success', `Saved provider "${provider.name}"`);
    },
    [aiProviders, notify, refreshProviderCredentials, updateSettings]
  );

  const deleteAiProvider = useCallback(
    async (providerId: string) => {
      const next = aiProviders.filter((p) => p.id !== providerId);
      await updateSettings({ aiProviders: next });
      notify('info', 'Removed provider configuration');
    },
    [aiProviders, notify, updateSettings]
  );

  const updateRoutingRule = useCallback(
    async (rule: TaskRoutingRule) => {
      const next = routingRules.map((r) => (r.taskType === rule.taskType ? rule : r));
      await updateSettings({ routingRules: next });
      notify('success', `Updated routing policy for ${rule.label}`);
    },
    [notify, routingRules, updateSettings]
  );

  const setRoutingPriority = useCallback(
    async (priority: RoutingPriority) => {
      await updateSettings({ routingPriority: priority });
      notify('success', `Global routing priority set to ${priority}`);
    },
    [notify, updateSettings]
  );

  const updateModelEntry = useCallback(
    async (entry: AIModelEntry) => {
      const exists = aiModels.some((m) => m.id === entry.id);
      const next = exists ? aiModels.map((m) => (m.id === entry.id ? entry : m)) : [...aiModels, entry];
      await updateSettings({ aiModels: next });
      notify('success', `Updated model "${entry.displayName}"`);
    },
    [aiModels, notify, updateSettings]
  );

  const resolveTaskPreview = useCallback(
    (taskType: TaskType, manualOverride?: { providerId: string; modelId?: string }) =>
      resolveTaskRoute({
        taskType,
        providers: aiProviders,
        models: aiModels,
        routingRules,
        credentials: providerCredentials,
        probes: providerProbes,
        priority: settings.routingPriority || 'quality',
        manualOverride,
      }),
    [aiModels, aiProviders, providerCredentials, providerProbes, routingRules, settings.routingPriority]
  );

  const runOrchestratedPrompt = useCallback(
    async (input: {
      taskType: TaskType;
      prompt: string;
      systemInstruction?: string;
      responseJson?: boolean;
      manualOverride?: { providerId: string; modelId?: string };
    }) => {
      const res = await executeOrchestratedAiTask({
        ...input,
        providers: aiProviders,
        models: aiModels,
        routingRules,
        priority: settings.routingPriority || 'quality',
      });
      if (res.usedFallback) {
        notify('info', res.userNotice);
      } else {
        notify('success', `Completed via ${res.providerUsed} (${res.modelUsed})`);
      }
      return res;
    },
    [aiModels, aiProviders, notify, routingRules, settings.routingPriority]
  );

  // Production Development & Document Management Actions
  const updateCreativeBrief = useCallback(
    (patch: Partial<CreativeBrief>) => {
      updateActiveProject((proj) => {
        const current = migrateProjectSchema(proj).creativeBrief!;
        return {
          ...proj,
          creativeBrief: {
            ...current,
            ...patch,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    },
    [updateActiveProject]
  );

  const upsertScreenplaySection = useCallback(
    (section: ScreenplaySceneSection) => {
      updateActiveProject((proj) => {
        const list = proj.screenplay || [];
        const exists = list.some((s) => s.id === section.id);
        return {
          ...proj,
          screenplay: exists
            ? list.map((s) => (s.id === section.id ? section : s))
            : [...list, section],
        };
      });
    },
    [updateActiveProject]
  );

  const deleteScreenplaySection = useCallback(
    (sectionId: string) => {
      updateActiveProject((proj) => ({
        ...proj,
        screenplay: (proj.screenplay || []).filter((s) => s.id !== sectionId),
      }));
    },
    [updateActiveProject]
  );

  const syncScreenplaySectionToScene = useCallback(
    (section: ScreenplaySceneSection) => {
      if (!activeProject) return;
      if (section.linkedSceneId) {
        updateActiveProject((proj) => ({
          ...proj,
          scenes: proj.scenes.map((sc) =>
            sc.id === section.linkedSceneId
              ? {
                  ...sc,
                  description: section.actionDescription || sc.description,
                  durationSeconds: section.estimatedDurationSec || sc.durationSeconds,
                }
              : sc
          ),
        }));
        notify('success', `Synced script section "${section.slugline}" to Scene Planner`);
      } else {
        const nextOrder = activeProject.scenes.length + 1;
        const engine = activeProject.settings.defaultEngine;
        const newSceneId = `scene_scr_${Date.now().toString(36)}`;
        const createdScene: ScenePlan = {
          id: newSceneId,
          order: nextOrder,
          title: `${String(nextOrder).padStart(2, '0')}. ${section.slugline}`,
          description: section.actionDescription || section.narration || 'Synced from Screenplay Studio.',
          referenceAssetIds: [],
          characterIds: section.dialogueBlocks
            .map((d) => d.characterId)
            .filter((id): id is string => Boolean(id)),
          environmentDescription: section.slugline,
          composition: 'Balanced medium framing',
          cameraFraming: 'Medium Shot',
          lighting: 'Natural key light',
          motionDirection: 'Natural scene progression',
          cameraMovement: 'Slow dolly push-in',
          durationSeconds: Math.max(2, section.estimatedDurationSec || 4),
          narrativePurpose: section.sequenceName || 'Script scene',
          positivePrompt: '',
          negativePrompt: '',
          selectedEngine: engine,
          generationSettings: { ...ENGINE_REGISTRY[engine].defaultParams },
          status: 'planned',
          approvedForGeneration: false,
        };
        updateActiveProject((proj) => ({
          ...proj,
          scenes: [...proj.scenes, createdScene],
          screenplay: (proj.screenplay || []).map((s) =>
            s.id === section.id ? { ...s, linkedSceneId: newSceneId } : s
          ),
        }));
        notify('success', `Created & linked Scene "${createdScene.title}"`);
      }
    },
    [activeProject, notify, updateActiveProject]
  );

  const upsertProductionDocument = useCallback(
    (doc: ProductionDocument) => {
      updateActiveProject((proj) => {
        const docs = proj.productionDocuments || [];
        const exists = docs.some((d) => d.id === doc.id);
        return {
          ...proj,
          productionDocuments: exists ? docs.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...docs],
        };
      });
    },
    [updateActiveProject]
  );

  const updateDocumentWithVersion = useCallback(
    (docId: string, patch: { title?: string; contentMarkdown?: string; summary?: string }) => {
      updateActiveProject((proj) => ({
        ...proj,
        productionDocuments: (proj.productionDocuments || []).map((d) =>
          d.id === docId ? updateProductionDocumentWithVersion(d, patch) : d
        ),
      }));
      notify('success', 'Saved new document version');
    },
    [notify, updateActiveProject]
  );

  const setDocumentApproval = useCallback(
    (docId: string, status: DocumentStatus) => {
      updateActiveProject((proj) => ({
        ...proj,
        productionDocuments: (proj.productionDocuments || []).map((d) =>
          d.id === docId ? setDocumentStatus(d, status) : d
        ),
      }));
      notify('success', `Document marked ${status.replace('_', ' ')}`);
    },
    [notify, updateActiveProject]
  );

  const addDocumentCommentToDoc = useCallback(
    (docId: string, author: string, text: string) => {
      updateActiveProject((proj) => ({
        ...proj,
        productionDocuments: (proj.productionDocuments || []).map((d) =>
          d.id === docId ? addDocumentComment(d, author, text) : d
        ),
      }));
    },
    [updateActiveProject]
  );

  const syncAutoDocsFromProject = useCallback(() => {
    if (!activeProject) return;
    const migrated = migrateProjectSchema(activeProject);
    const lang = migrated.creativeBrief?.primaryLanguage || 'en';
    const sceneIds = migrated.scenes.map((s) => s.id);
    const charIds = migrated.characters.map((c) => c.id);

    const docs = [
      createProductionDocument({
        id: `doc_brief_${migrated.id}`,
        type: 'creative_brief',
        title: `${migrated.name} — Creative Brief`,
        language: lang,
        contentMarkdown: renderCreativeBriefMarkdown(migrated),
        linkedSceneIds: sceneIds,
        linkedCharacterIds: charIds,
      }),
      createProductionDocument({
        id: `doc_screenplay_${migrated.id}`,
        type: 'screenplay',
        title: `${migrated.name} — Master Screenplay`,
        language: lang,
        contentMarkdown: renderScreenplayMarkdown(migrated),
        linkedSceneIds: sceneIds,
      }),
      createProductionDocument({
        id: `doc_breakdown_${migrated.id}`,
        type: 'breakdown',
        title: `${migrated.name} — Scene Breakdown`,
        language: lang,
        contentMarkdown: renderBreakdownMarkdown(migrated),
        linkedSceneIds: sceneIds,
        linkedCharacterIds: charIds,
      }),
      createProductionDocument({
        id: `doc_characters_${migrated.id}`,
        type: 'character_bible',
        title: `${migrated.name} — Character Bible`,
        language: lang,
        contentMarkdown: renderCharacterBibleMarkdown(migrated),
        linkedCharacterIds: charIds,
      }),
      createProductionDocument({
        id: `doc_costumes_${migrated.id}`,
        type: 'costume_bible',
        title: `${migrated.name} — Costume & Wardrobe Bible`,
        language: lang,
        contentMarkdown: renderCostumeBibleMarkdown(migrated),
        linkedSceneIds: sceneIds,
        linkedCharacterIds: charIds,
      }),
      createProductionDocument({
        id: `doc_locations_${migrated.id}`,
        type: 'location_bible',
        title: `${migrated.name} — Location Bible`,
        language: lang,
        contentMarkdown: renderLocationBibleMarkdown(migrated),
        linkedSceneIds: sceneIds,
      }),
      createProductionDocument({
        id: `doc_props_${migrated.id}`,
        type: 'props_inventory',
        title: `${migrated.name} — Props & Set Design List`,
        language: lang,
        contentMarkdown: renderPropsListMarkdown(migrated),
        linkedSceneIds: sceneIds,
        linkedCharacterIds: charIds,
      }),
      createProductionDocument({
        id: `doc_storyboard_${migrated.id}`,
        type: 'storyboard',
        title: `${migrated.name} — Storyboard Contact Sheet`,
        language: lang,
        contentMarkdown: renderStoryboardMarkdown(migrated),
        linkedSceneIds: sceneIds,
      }),
      createProductionDocument({
        id: `doc_shotlist_${migrated.id}`,
        type: 'shot_list',
        title: `${migrated.name} — Shot List`,
        language: lang,
        contentMarkdown: renderShotListMarkdown(migrated),
        linkedSceneIds: sceneIds,
      }),
      createProductionDocument({
        id: `doc_schedule_${migrated.id}`,
        type: 'production_schedule',
        title: `${migrated.name} — Production Schedule`,
        language: lang,
        contentMarkdown: renderProductionScheduleMarkdown(migrated),
        linkedSceneIds: sceneIds,
      }),
      createProductionDocument({
        id: `doc_preprod_package_${migrated.id}`,
        type: 'preproduction_package',
        title: `${migrated.name} — Complete Pre-Production Package`,
        language: lang,
        contentMarkdown: renderCompletePreProductionPackageMarkdown(migrated),
        linkedSceneIds: sceneIds,
        linkedCharacterIds: charIds,
      }),
    ];

    updateActiveProject((proj) => {
      const existing = proj.productionDocuments || [];
      const merged = [...existing];
      for (const generated of docs) {
        const idx = merged.findIndex((d) => d.id === generated.id);
        if (idx >= 0) {
          merged[idx] = updateProductionDocumentWithVersion(merged[idx], {
            contentMarkdown: generated.contentMarkdown,
            summary: 'Regenerated from project entities',
          });
        } else {
          merged.push(generated);
        }
      }
      return { ...proj, productionDocuments: merged };
    });
    notify('success', 'Synchronized all Pre-Production Documents with current project entities');
  }, [activeProject, notify, updateActiveProject]);

  // Phase C: Costumes, Locations, Props, Storyboards, Shots, Schedule CRUD
  const upsertCostume = useCallback(
    (costume: CostumeSpec) => {
      updateActiveProject((proj) => {
        const list = proj.costumes || [];
        const exists = list.some((c) => c.id === costume.id);
        return {
          ...proj,
          costumes: exists ? list.map((c) => (c.id === costume.id ? costume : c)) : [costume, ...list],
        };
      });
    },
    [updateActiveProject]
  );

  const deleteCostume = useCallback(
    (costumeId: string) => {
      updateActiveProject((proj) => removeCostumeSafely(proj, costumeId));
      notify('info', 'Removed costume and cleared scene references');
    },
    [notify, updateActiveProject]
  );

  const upsertLocation = useCallback(
    (location: LocationSpec) => {
      updateActiveProject((proj) => {
        const list = proj.locations || [];
        const exists = list.some((l) => l.id === location.id);
        return {
          ...proj,
          locations: exists ? list.map((l) => (l.id === location.id ? location : l)) : [location, ...list],
        };
      });
    },
    [updateActiveProject]
  );

  const deleteLocation = useCallback(
    (locationId: string) => {
      updateActiveProject((proj) => removeLocationSafely(proj, locationId));
      notify('info', 'Removed location and cleared dangling scene links');
    },
    [notify, updateActiveProject]
  );

  const upsertProp = useCallback(
    (prop: PropSpec) => {
      updateActiveProject((proj) => {
        const list = proj.props || [];
        const exists = list.some((p) => p.id === prop.id);
        return {
          ...proj,
          props: exists ? list.map((p) => (p.id === prop.id ? prop : p)) : [prop, ...list],
        };
      });
    },
    [updateActiveProject]
  );

  const deleteProp = useCallback(
    (propId: string) => {
      updateActiveProject((proj) => removePropSafely(proj, propId));
      notify('info', 'Removed prop and cleared scene/shot references');
    },
    [notify, updateActiveProject]
  );

  const upsertStoryboardFrame = useCallback(
    (frame: StoryboardFrameSpec) => {
      updateActiveProject((proj) => {
        const list = proj.storyboardFrames || [];
        const exists = list.some((f) => f.id === frame.id);
        return {
          ...proj,
          storyboardFrames: exists
            ? list.map((f) => (f.id === frame.id ? frame : f))
            : [...list, frame],
        };
      });
    },
    [updateActiveProject]
  );

  const deleteStoryboardFrame = useCallback(
    (frameId: string) => {
      updateActiveProject((proj) => removeStoryboardFrameSafely(proj, frameId));
      notify('info', 'Deleted storyboard frame');
    },
    [notify, updateActiveProject]
  );

  const reorderStoryboardFrame = useCallback(
    (sceneId: string, frameId: string, direction: 'up' | 'down') => {
      updateActiveProject((proj) => ({
        ...proj,
        storyboardFrames: reorderStoryboardFramesForScene(
          proj.storyboardFrames || [],
          sceneId,
          frameId,
          direction
        ),
      }));
    },
    [updateActiveProject]
  );

  const upsertShot = useCallback(
    (shot: ShotSpec) => {
      updateActiveProject((proj) => {
        const list = proj.shotList || [];
        const exists = list.some((s) => s.id === shot.id);
        return {
          ...proj,
          shotList: exists ? list.map((s) => (s.id === shot.id ? shot : s)) : [...list, shot],
        };
      });
    },
    [updateActiveProject]
  );

  const createShotFromStoryboard = useCallback(
    (frame: StoryboardFrameSpec) => {
      const created = buildShotFromStoryboardFrame(frame);
      updateActiveProject((proj) => ({
        ...proj,
        shotList: [...(proj.shotList || []), created],
        storyboardFrames: (proj.storyboardFrames || []).map((f) =>
          f.id === frame.id ? { ...f, shotId: created.id } : f
        ),
      }));
      notify('success', `Created Shot ${created.shotNumber} from Storyboard Frame`);
      return created;
    },
    [notify, updateActiveProject]
  );

  const deleteShot = useCallback(
    (shotId: string) => {
      updateActiveProject((proj) => removeShotSafely(proj, shotId));
      notify('info', 'Deleted shot from Shot List');
    },
    [notify, updateActiveProject]
  );

  const upsertProductionTask = useCallback(
    (task: ProductionTask) => {
      updateActiveProject((proj) => {
        const list = proj.productionTasks || [];
        const exists = list.some((t) => t.id === task.id);
        return {
          ...proj,
          productionTasks: exists ? list.map((t) => (t.id === task.id ? task : t)) : [...list, task],
        };
      });
    },
    [updateActiveProject]
  );

  const deleteProductionTask = useCallback(
    (taskId: string) => {
      updateActiveProject((proj) => removeProductionTaskSafely(proj, taskId));
      notify('info', 'Removed production task');
    },
    [notify, updateActiveProject]
  );

  const continuityAlerts = useMemo(
    () => (activeProject ? analyzeProjectContinuity(activeProject) : []),
    [activeProject]
  );

  const addManualContinuityAlert = useCallback(
    (input: {
      title: string;
      description: string;
      category: ContinuityAlert['category'];
      severity: ContinuityAlert['severity'];
      affectedEntityIds: string[];
    }) => {
      const alert: ContinuityAlert = {
        id: `manual_cont_${Date.now().toString(36)}`,
        severity: input.severity,
        classification:
          input.severity === 'action_required'
            ? 'critical'
            : input.severity === 'info'
            ? 'informational'
            : 'warning',
        category: input.category,
        source: 'manual',
        title: input.title.trim(),
        description: input.description.trim(),
        affectedEntityIds: input.affectedEntityIds,
        createdAt: new Date().toISOString(),
        resolved: false,
      };
      updateActiveProject((proj) => ({
        ...proj,
        continuityAlerts: [alert, ...(proj.continuityAlerts || [])],
      }));
      notify('success', 'Logged manual continuity note');
    },
    [notify, updateActiveProject]
  );

  const toggleContinuityAlertResolved = useCallback(
    (alertId: string) => {
      const current = continuityAlerts.find((a) => a.id === alertId);
      if (!current) return;
      updateActiveProject((proj) => {
        const list = proj.continuityAlerts || [];
        const exists = list.some((a) => a.id === alertId);
        const toggled: ContinuityAlert = { ...current, resolved: !current.resolved };
        return {
          ...proj,
          continuityAlerts: exists
            ? list.map((a) => (a.id === alertId ? toggled : a))
            : [toggled, ...list],
        };
      });
    },
    [continuityAlerts, updateActiveProject]
  );

  const markContinuityIntentional = useCallback(
    (alertId: string, intentional: boolean, explanation?: string) => {
      const current = continuityAlerts.find((a) => a.id === alertId);
      if (!current) return;
      updateActiveProject((proj) => {
        const list = proj.continuityAlerts || [];
        const exists = list.some((a) => a.id === alertId);
        const updated: ContinuityAlert = {
          ...current,
          intentionalDifference: intentional,
          explanation: explanation !== undefined ? explanation : current.explanation,
          resolved: intentional ? true : current.resolved,
        };
        return {
          ...proj,
          continuityAlerts: exists
            ? list.map((a) => (a.id === alertId ? updated : a))
            : [updated, ...list],
        };
      });
      notify('success', intentional ? 'Marked as intentional creative choice' : 'Removed intentional marker');
    },
    [continuityAlerts, notify, updateActiveProject]
  );

  return {
    projects,
    activeProject,
    activeProjectId,
    activeSection,
    setActiveSection,
    settings,
    updateSettings,
    hydrated,
    saveStatus,
    lastSavedAt,
    backendHealth,
    comfyStats,
    comfyStatus: effectiveComfyStatus,
    comfyModels,
    ltxCapability,
    wanCapability,
    qwenReport,
    activeRenderJob,
    comfyE2EResult,
    modelCatalog,
    aiProviders,
    aiModels,
    routingRules,
    providerCredentials,
    providerProbes,
    continuityAlerts,
    toastMessage,
    notify,
    selectProject,
    createProject,
    duplicateProject,
    renameProject,
    removeProject,
    resetDemoProject,
    updateActiveProject,
    checkComfyConnection,
    checkQwenConnection,
    runComfyE2ETest,
    startServerMp4Render,
    uploadMedia,
    analyzeAsset,
    saveAnalysisCorrection,
    upsertCharacter,
    replaceCharacters,
    deleteCharacter,
    addScene,
    updateScene,
    reorderScene,
    generateAiScenesForProject,
    compileAndSavePrompt,
    submitGenerationJob,
    retryJob,
    cancelJob,
    updateClipQuality,
    addClipToTimeline,
    exportCurrentProjectZip,
    importProjectZip,
    setLyrics,
    refreshProviderCredentials,
    saveProviderSecret,
    probeAiProvider,
    upsertAiProvider,
    deleteAiProvider,
    updateRoutingRule,
    setRoutingPriority,
    updateModelEntry,
    resolveTaskPreview,
    runOrchestratedPrompt,
    updateCreativeBrief,
    upsertScreenplaySection,
    deleteScreenplaySection,
    syncScreenplaySectionToScene,
    upsertProductionDocument,
    updateDocumentWithVersion,
    setDocumentApproval,
    addDocumentCommentToDoc,
    syncAutoDocsFromProject,
    upsertCostume,
    deleteCostume,
    upsertLocation,
    deleteLocation,
    upsertProp,
    deleteProp,
    upsertStoryboardFrame,
    deleteStoryboardFrame,
    reorderStoryboardFrame,
    upsertShot,
    createShotFromStoryboard,
    deleteShot,
    upsertProductionTask,
    deleteProductionTask,
    addManualContinuityAlert,
    toggleContinuityAlertResolved,
    markContinuityIntentional,
  };
}

export type StudioStore = ReturnType<typeof useStudioStore>;
