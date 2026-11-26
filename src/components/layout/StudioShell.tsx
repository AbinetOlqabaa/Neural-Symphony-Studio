import { useState, type ReactNode } from 'react';
import {
  Activity,
  BookOpen,
  CalendarClock,
  Camera,
  Clapperboard,
  ClipboardList,
  Cpu,
  Download,
  FileText,
  Film,
  FolderKanban,
  GitBranch,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  MapPin,
  Menu,
  Music,
  Network,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Route,
  ScanSearch,
  Settings,
  ShieldCheck,
  Shirt,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import type { NavSection } from '../../types/studio';

interface NavGroup {
  label: string;
  items: Array<{ id: NavSection; label: string; icon: typeof LayoutDashboard }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'projects', label: 'Projects', icon: FolderKanban },
      { id: 'media', label: 'Media Library', icon: ImageIcon },
    ],
  },
  {
    label: 'Production Development',
    items: [
      { id: 'creative', label: 'Creative Development', icon: Lightbulb },
      { id: 'screenplay', label: 'Screenplay Studio', icon: BookOpen },
      { id: 'documents', label: 'Production Documents', icon: FileText },
      { id: 'continuity', label: 'Continuity Dashboard', icon: ShieldCheck },
    ],
  },
  {
    label: 'Visual Pre-Production',
    items: [
      { id: 'breakdown', label: 'Scene Breakdown', icon: ClipboardList },
      { id: 'characters', label: 'Character Bible', icon: Users },
      { id: 'costumes', label: 'Costume Bible', icon: Shirt },
      { id: 'locations', label: 'Location Bible', icon: MapPin },
      { id: 'props', label: 'Props & Set Design', icon: Package },
      { id: 'storyboard', label: 'Storyboard Studio', icon: LayoutGrid },
      { id: 'shots', label: 'Shot List', icon: Camera },
      { id: 'schedule', label: 'Production Schedule', icon: CalendarClock },
    ],
  },
  {
    label: 'Intelligence & Plan',
    items: [
      { id: 'intelligence', label: 'Image Intelligence', icon: ScanSearch },
      { id: 'scenes', label: 'Scene Planner', icon: Clapperboard },
      { id: 'prompts', label: 'Prompt Studio', icon: Sparkles },
    ],
  },
  {
    label: 'Production',
    items: [
      { id: 'generation', label: 'Generation Studio', icon: Film },
      { id: 'queue', label: 'Job Queue', icon: ListChecks },
      { id: 'timeline', label: 'Video Timeline', icon: Layers },
      { id: 'music', label: 'Music and Lyrics', icon: Music },
      { id: 'export', label: 'Export Center', icon: Download },
    ],
  },
  {
    label: 'AI Intelligence & Backend',
    items: [
      { id: 'providers', label: 'AI Providers', icon: Network },
      { id: 'routing', label: 'Model Routing', icon: Route },
      { id: 'models', label: 'Model Manager', icon: Cpu },
      { id: 'workflows', label: 'Workflow Editor', icon: GitBranch },
      { id: 'monitor', label: 'System Monitor', icon: Activity },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface StudioShellProps {
  store: StudioStore;
  children: ReactNode;
}

export function StudioShell({ store, children }: StudioShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState('');

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError('Project name is required.');
      return;
    }
    await store.createProject(newName, newDescription);
    setNewName('');
    setNewDescription('');
    setFormError('');
    setNewProjectOpen(false);
  };

  const activeNavLabel =
    NAV_GROUPS.flatMap((g) => g.items).find((item) => item.id === store.activeSection)?.label || 'Dashboard';

  return (
    <div className="min-h-screen flex bg-[var(--ns-bg)] text-[var(--ns-text)]">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-[var(--ns-border)] bg-[var(--ns-surface)] transition-[width] duration-150 ${
          sidebarCollapsed ? 'w-[68px]' : 'w-[248px]'
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--ns-border)]">
          {!sidebarCollapsed && (
            <span className="font-display font-semibold text-sm tracking-tight whitespace-nowrap truncate">
              Neural Symphony
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
            className="p-1.5 rounded-md text-[var(--ns-text-muted)] hover:text-[var(--ns-text)] hover:bg-[var(--ns-surface-elevated)] transition-colors"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav aria-label="Studio navigation" className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!sidebarCollapsed && (
                <div className="px-2.5 pb-1.5 text-[11px] font-medium text-[var(--ns-text-subtle)]">
                  {group.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = store.activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => store.setActiveSection(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[var(--ns-accent)]/15 text-[var(--ns-text)] border border-[var(--ns-accent)]/35'
                            : 'text-[var(--ns-text-muted)] hover:text-[var(--ns-text)] hover:bg-[var(--ns-surface-elevated)] border border-transparent'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <div className="p-3 border-t border-[var(--ns-border)] text-xs text-[var(--ns-text-subtle)] space-y-1">
            <div className="flex items-center justify-between">
              <span>ComfyUI</span>
              <span
                className={
                  store.comfyStatus === 'connected'
                    ? 'text-[var(--ns-success)]'
                    : store.comfyStatus === 'authentication_required' || store.comfyStatus === 'configuration_invalid'
                    ? 'text-[var(--ns-danger)]'
                    : 'text-[var(--ns-text-muted)]'
                }
              >
                {store.comfyStatus === 'connected'
                  ? 'Connected'
                  : store.comfyStatus === 'connecting'
                  ? 'Connecting...'
                  : store.comfyStatus === 'authentication_required'
                  ? 'Auth required'
                  : store.comfyStatus === 'unreachable'
                  ? 'Unreachable'
                  : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Autosave</span>
              <span className="tabular-nums">
                {store.saveStatus === 'saving'
                  ? 'Saving...'
                  : store.saveStatus === 'error'
                  ? 'Error'
                  : 'Saved'}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] bg-[var(--ns-surface)] border-r border-[var(--ns-border)] flex flex-col z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--ns-border)]">
              <span className="font-display font-semibold text-sm">Neural Symphony</span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-md text-[var(--ns-text-muted)] hover:text-[var(--ns-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav aria-label="Mobile studio navigation" className="flex-1 overflow-y-auto p-3 space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="px-2 pb-1 text-xs font-medium text-[var(--ns-text-subtle)]">{group.label}</div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = store.activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            store.setActiveSection(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-sm font-medium ${
                            active
                              ? 'bg-[var(--ns-accent)]/15 text-[var(--ns-text)]'
                              : 'text-[var(--ns-text-muted)] hover:text-[var(--ns-text)]'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Toolbar (Strict 3-zone header) */}
        <header className="h-14 px-4 lg:px-6 border-b border-[var(--ns-border)] bg-[var(--ns-surface)] flex items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-md text-[var(--ns-text-muted)] hover:text-[var(--ns-text)] hover:bg-[var(--ns-surface-elevated)]"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="font-display font-semibold text-sm text-[var(--ns-text)] whitespace-nowrap shrink-0">
              {activeNavLabel}
            </span>
            {store.activeProject && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--ns-text-muted)] truncate">
                <span aria-hidden="true">/</span>
                <span className="truncate max-w-[240px]">{store.activeProject.name}</span>
                {store.activeProject.isDemoProject && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--ns-accent-blue)] whitespace-nowrap">Demo Data</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3 min-w-0">
            <label htmlFor="top-project-switcher" className="sr-only">
              Active project
            </label>
            <select
              id="top-project-switcher"
              value={store.activeProject?.id || ''}
              onChange={(e) => void store.selectProject(e.target.value)}
              className="h-8 px-2.5 text-xs bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] rounded-md text-[var(--ns-text)] max-w-[240px]"
            >
              {store.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setNewProjectOpen(true)}
              className="h-8 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[1360px] mx-auto">{children}</div>
        </main>
      </div>

      {/* Toast Feedback */}
      {store.toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-sm z-50 px-4 py-2.5 rounded-md border text-xs font-medium shadow-lg ${
            store.toastMessage.type === 'error'
              ? 'bg-[var(--ns-surface-elevated)] border-[var(--ns-danger)] text-[var(--ns-danger)]'
              : store.toastMessage.type === 'success'
              ? 'bg-[var(--ns-surface-elevated)] border-[var(--ns-success)] text-[var(--ns-success)]'
              : 'bg-[var(--ns-surface-elevated)] border-[var(--ns-border-strong)] text-[var(--ns-text)]'
          }`}
        >
          {store.toastMessage.text}
        </div>
      )}

      {/* New Project Modal */}
      {newProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-modal-title"
            className="w-full max-w-md bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 id="new-project-modal-title" className="font-display font-semibold text-base">
                Create Production Project
              </h2>
              <button
                type="button"
                aria-label="Close new project dialog"
                onClick={() => setNewProjectOpen(false)}
                className="p-1 text-[var(--ns-text-muted)] hover:text-[var(--ns-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateProject(e)} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="new-project-name" className="block text-xs font-medium text-[var(--ns-text-muted)]">
                  Project Name
                </label>
                <input
                  id="new-project-name"
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setFormError('');
                  }}
                  placeholder="e.g., Addis Skyline Session"
                  className="w-full h-9 px-3 text-sm rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-[var(--ns-text)]"
                />
                {formError && <p className="text-xs text-[var(--ns-danger)]">{formError}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="new-project-desc" className="block text-xs font-medium text-[var(--ns-text-muted)]">
                  Creative Concept & Brief
                </label>
                <textarea
                  id="new-project-desc"
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Mood, tempo, visual references, and narrative arc..."
                  className="w-full p-3 text-sm rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-[var(--ns-text)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewProjectOpen(false)}
                  className="h-9 px-4 rounded-md border border-[var(--ns-border)] text-xs font-medium text-[var(--ns-text-muted)] hover:text-[var(--ns-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
