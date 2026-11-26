import { useRef, useState } from 'react';
import { Copy, Download, FolderOpen, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import type { ProjectStatus } from '../../types/studio';

export function ProjectsView({ store }: { store: StudioStore }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('draft');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | ProjectStatus>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = store.projects.filter((p) => (filterStatus === 'all' ? true : p.status === filterStatus));

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      store.notify('error', 'Enter a project name before creating.');
      return;
    }
    await store.createProject(newName, newDesc);
    setNewName('');
    setNewDesc('');
  };

  return (
    <div className="space-y-6">
      {/* Header + Import/Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold">Project Management</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Projects autosave locally to IndexedDB and export as portable ZIP archives with full manifests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void store.importProjectZip(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 px-3.5 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] hover:bg-[var(--ns-surface-elevated)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Project ZIP</span>
          </button>
          <button
            type="button"
            onClick={() => void store.exportCurrentProjectZip()}
            className="h-9 px-3.5 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] hover:bg-[var(--ns-surface-elevated)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Active ZIP</span>
          </button>
          <button
            type="button"
            onClick={() => void store.resetDemoProject()}
            className="h-9 px-3.5 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] hover:bg-[var(--ns-surface-elevated)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Demo Project</span>
          </button>
        </div>
      </div>

      {/* Quick Create Form */}
      <form
        onSubmit={(e) => void handleQuickCreate(e)}
        className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
      >
        <div className="md:col-span-4 space-y-1">
          <label htmlFor="quick-proj-name" className="block text-xs font-medium text-[var(--ns-text-muted)]">
            New Project Name
          </label>
          <input
            id="quick-proj-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., Dawn Over Entoto"
            className="w-full h-9 px-3 text-sm rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
          />
        </div>
        <div className="md:col-span-6 space-y-1">
          <label htmlFor="quick-proj-desc" className="block text-xs font-medium text-[var(--ns-text-muted)]">
            Description
          </label>
          <input
            id="quick-proj-desc"
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Brief creative direction and visual style"
            className="w-full h-9 px-3 text-sm rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="w-full h-9 px-4 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
        </div>
      </form>

      {/* Status Filter Bar */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-md w-fit">
        {(['all', 'draft', 'in_production', 'review', 'completed', 'archived'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              filterStatus === status
                ? 'bg-[var(--ns-accent)] text-white'
                : 'text-[var(--ns-text-muted)] hover:text-[var(--ns-text)]'
            }`}
          >
            {status === 'all' ? 'All Projects' : status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Project List */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.map((proj) => {
          const isEditing = editingId === proj.id;
          const isActive = proj.id === store.activeProject?.id;
          return (
            <div
              key={proj.id}
              className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-3"
            >
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4 space-y-1">
                    <label className="block text-xs text-[var(--ns-text-muted)]">Project Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full h-9 px-3 text-sm rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    />
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <label className="block text-xs text-[var(--ns-text-muted)]">Description</label>
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full h-9 px-3 text-sm rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-xs text-[var(--ns-text-muted)]">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                      className="w-full h-9 px-2 text-xs rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    >
                      <option value="draft">Draft</option>
                      <option value="in_production">In Production</option>
                      <option value="review">Review</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void store.renameProject(proj.id, editName, editDesc, editStatus);
                        setEditingId(null);
                      }}
                      className="flex-1 h-9 rounded-md bg-[var(--ns-accent)] text-white text-xs font-medium"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="h-9 px-3 rounded-md border border-[var(--ns-border)] text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ns-text-muted)]">
                      <span className="font-mono">{proj.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{proj.status.replace('_', ' ')}</span>
                      {proj.isDemoProject && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[var(--ns-accent-blue)]">Demo Data</span>
                        </>
                      )}
                      {isActive && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[var(--ns-success)]">Active Workspace</span>
                        </>
                      )}
                    </div>
                    <h2 className="font-display text-base font-semibold truncate">{proj.name}</h2>
                    <p className="text-xs text-[var(--ns-text-muted)]">{proj.description}</p>
                    <div className="text-xs text-[var(--ns-text-subtle)] tabular-nums pt-0.5">
                      {proj.mediaAssets.length} images · {proj.characters.length} characters · {proj.scenes.length} scenes · {proj.clips.length} clips · Updated {new Date(proj.updatedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        void store.selectProject(proj.id);
                        store.setActiveSection('media');
                      }}
                      className="h-8 px-3 rounded-md bg-[var(--ns-surface-elevated)] border border-[var(--ns-border)] hover:border-[var(--ns-border-strong)] text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Open</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(proj.id);
                        setEditName(proj.name);
                        setEditDesc(proj.description);
                        setEditStatus(proj.status);
                      }}
                      className="h-8 px-3 rounded-md border border-[var(--ns-border)] text-xs font-medium hover:bg-[var(--ns-surface-elevated)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void store.duplicateProject(proj.id)}
                      aria-label={`Duplicate ${proj.name}`}
                      className="h-8 px-2.5 rounded-md border border-[var(--ns-border)] text-xs hover:bg-[var(--ns-surface-elevated)]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void store.renameProject(proj.id, proj.name, proj.description, 'archived')}
                      className="h-8 px-3 rounded-md border border-[var(--ns-border)] text-xs text-[var(--ns-text-muted)] hover:text-[var(--ns-text)]"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => void store.removeProject(proj.id)}
                      aria-label={`Delete ${proj.name}`}
                      className="h-8 px-2.5 rounded-md border border-[var(--ns-border)] text-[var(--ns-danger)] hover:bg-[var(--ns-danger)]/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
