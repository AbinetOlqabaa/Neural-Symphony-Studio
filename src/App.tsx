import { CharactersView, ImageIntelligenceView } from './components/characters/IntelligenceAndCharactersViews';
import { DashboardView } from './components/dashboard/DashboardView';
import { GenerationStudioView, JobQueueView } from './components/generation/GenerationAndQueueViews';
import { StudioShell } from './components/layout/StudioShell';
import { MediaLibraryView } from './components/media/MediaLibraryView';
import { AiProvidersView, ModelRoutingView } from './components/orchestration/AiOrchestrationViews';
import {
  ContinuityDashboardView,
  CreativeDevelopmentView,
  ProductionDocumentsView,
  ScreenplayStudioView,
} from './components/production/ProductionDevelopmentViews';
import { ProductionScheduleView } from './components/preproduction/ProductionScheduleView';
import { SceneBreakdownView } from './components/preproduction/SceneBreakdownView';
import { ShotListView, StoryboardStudioView } from './components/preproduction/StoryboardAndShotViews';
import {
  CostumeBibleView,
  LocationBibleView,
  PropsSetDesignView,
} from './components/preproduction/WardrobeLocationPropsViews';
import { ProjectsView } from './components/projects/ProjectsView';
import { PromptStudioView, ScenePlannerView } from './components/scenes/ScenesAndPromptsViews';
import { MusicLyricsView, VideoTimelineView } from './components/timeline/TimelineAndMusicViews';
import {
  ExportCenterView,
  ModelManagerView,
  SettingsView,
  SystemMonitorView,
  WorkflowEditorView,
} from './components/workflows/ExportWorkflowsModelsMonitorSettings';
import { useStudioStore } from './hooks/useStudioStore';

export default function App() {
  const store = useStudioStore();

  if (!store.hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ns-bg)] text-[var(--ns-text-muted)] text-sm">
        Loading Neural Symphony Studio workspace...
      </div>
    );
  }

  const renderSection = () => {
    switch (store.activeSection) {
      case 'dashboard':
        return <DashboardView store={store} />;
      case 'projects':
        return <ProjectsView store={store} />;
      case 'creative':
        return <CreativeDevelopmentView store={store} />;
      case 'screenplay':
        return <ScreenplayStudioView store={store} />;
      case 'documents':
        return <ProductionDocumentsView store={store} />;
      case 'continuity':
        return <ContinuityDashboardView store={store} />;
      case 'breakdown':
        return <SceneBreakdownView store={store} />;
      case 'costumes':
        return <CostumeBibleView store={store} />;
      case 'locations':
        return <LocationBibleView store={store} />;
      case 'props':
        return <PropsSetDesignView store={store} />;
      case 'storyboard':
        return <StoryboardStudioView store={store} />;
      case 'shots':
        return <ShotListView store={store} />;
      case 'schedule':
        return <ProductionScheduleView store={store} />;
      case 'media':
        return <MediaLibraryView store={store} />;
      case 'intelligence':
        return <ImageIntelligenceView store={store} />;
      case 'characters':
        return <CharactersView store={store} />;
      case 'scenes':
        return <ScenePlannerView store={store} />;
      case 'prompts':
        return <PromptStudioView store={store} />;
      case 'generation':
        return <GenerationStudioView store={store} />;
      case 'queue':
        return <JobQueueView store={store} />;
      case 'timeline':
        return <VideoTimelineView store={store} />;
      case 'music':
        return <MusicLyricsView store={store} />;
      case 'export':
        return <ExportCenterView store={store} />;
      case 'providers':
        return <AiProvidersView store={store} />;
      case 'routing':
        return <ModelRoutingView store={store} />;
      case 'workflows':
        return <WorkflowEditorView store={store} />;
      case 'models':
        return <ModelManagerView store={store} />;
      case 'monitor':
        return <SystemMonitorView store={store} />;
      case 'settings':
        return <SettingsView store={store} />;
      default:
        return <DashboardView store={store} />;
    }
  };

  return <StudioShell store={store}>{renderSection()}</StudioShell>;
}
