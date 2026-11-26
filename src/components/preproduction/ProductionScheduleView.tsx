import { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Columns3,
  GanttChart,
  List,
  Plus,
  Trash2,
} from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import type {
  ProductionTask,
  ProductionTaskPhase,
  ProductionTaskStatus,
} from '../../types/studio';

type ScheduleViewMode = 'list' | 'kanban' | 'calendar' | 'timeline';

const PHASE_LABELS: Record<ProductionTaskPhase, string> = {
  pre_production: 'Pre-Production',
  production: 'Production / Generation',
  post_production: 'Post-Production',
};

const STATUS_LABELS: Record<ProductionTaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
};

function parseDateMs(isoDate: string): number {
  const ms = Date.parse(isoDate);
  return Number.isFinite(ms) ? ms : Date.now();
}

export function ProductionScheduleView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('list');
  const [phaseFilter, setPhaseFilter] = useState<ProductionTaskPhase | 'all'>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const tasks = useMemo(() => {
    const raw = project?.productionTasks || [];
    return raw
      .filter((t) => (phaseFilter === 'all' ? true : t.phase === phaseFilter))
      .slice()
      .sort((a, b) => parseDateMs(a.startDate) - parseDateMs(b.startDate));
  }, [project?.productionTasks, phaseFilter]);

  if (!project) return null;

  const selected = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  const handleAddTask = () => {
    const id = `task_${Date.now().toString(36)}`;
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const newTask: ProductionTask = {
      id,
      phase: phaseFilter === 'all' ? 'pre_production' : phaseFilter,
      title: 'New Production Task',
      description: 'Specify deliverables, dependencies, and readiness checks.',
      responsiblePerson: 'Producer',
      startDate: today,
      endDate: end,
      priority: 'medium',
      status: 'todo',
      dependencyIds: [],
      sceneId: project.scenes[0]?.id,
      notes: '',
      updatedAt: new Date().toISOString(),
    };
    store.upsertProductionTask(newTask);
    setSelectedTaskId(id);
    store.notify('success', 'Added production schedule task');
  };

  // Timeline / Gantt math
  const dateBounds = useMemo(() => {
    if (tasks.length === 0) {
      const now = Date.now();
      return { minMs: now, spanMs: 7 * 86400000 };
    }
    const starts = tasks.map((t) => parseDateMs(t.startDate));
    const ends = tasks.map((t) => Math.max(parseDateMs(t.endDate), parseDateMs(t.startDate) + 86400000));
    const minMs = Math.min(...starts);
    const maxMs = Math.max(...ends);
    return {
      minMs,
      spanMs: Math.max(86400000, maxMs - minMs),
    };
  }, [tasks]);

  // Calendar grouping by YYYY-MM-DD startDate
  const calendarGroups = useMemo(() => {
    const map = new Map<string, ProductionTask[]>();
    for (const task of tasks) {
      const key = task.startDate || 'Unscheduled';
      const arr = map.get(key) || [];
      arr.push(task);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Production Schedule & Planning</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Coordinate Pre-Production, Production, and Post-Production milestones, dependencies, scene/shot assignments, and timelines offline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter tasks by production phase"
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value as ProductionTaskPhase | 'all')}
            className="h-9 px-2.5 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          >
            <option value="all">All Phases ({project.productionTasks?.length || 0})</option>
            <option value="pre_production">Pre-Production</option>
            <option value="production">Production / Generation</option>
            <option value="post_production">Post-Production</option>
          </select>

          <div
            role="group"
            aria-label="Schedule view mode"
            className="inline-flex rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] overflow-hidden text-xs"
          >
            {(
              [
                { id: 'list', label: 'List', Icon: List },
                { id: 'kanban', label: 'Board', Icon: Columns3 },
                { id: 'calendar', label: 'Calendar', Icon: Calendar },
                { id: 'timeline', label: 'Timeline', Icon: GanttChart },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = viewMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewMode(id)}
                  aria-pressed={active}
                  className={`h-9 px-2.5 inline-flex items-center gap-1.5 border-r last:border-r-0 border-[var(--ns-border)] ${
                    active
                      ? 'bg-[var(--ns-accent)]/15 text-[var(--ns-text)] font-medium'
                      : 'text-[var(--ns-text-muted)] hover:text-[var(--ns-text)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddTask}
            className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* View Modes */}
      {tasks.length === 0 ? (
        <div className="p-8 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] text-center text-xs text-[var(--ns-text-muted)]">
          No production schedule tasks in this phase yet. Click Add Task to build your milestone plan.
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[740px]">
            <thead>
              <tr className="border-b border-[var(--ns-border)] text-[11px] text-[var(--ns-text-subtle)] bg-[var(--ns-surface-inset)]">
                <th className="py-2.5 px-3 font-medium">Task</th>
                <th className="py-2.5 px-3 font-medium">Phase</th>
                <th className="py-2.5 px-3 font-medium">Assignee</th>
                <th className="py-2.5 px-3 font-medium">Dates</th>
                <th className="py-2.5 px-3 font-medium">Priority</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium">Deps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ns-border)]">
              {tasks.map((task) => {
                const isSel = selected?.id === task.id;
                return (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`cursor-pointer transition-colors ${
                      isSel ? 'bg-[var(--ns-accent)]/10' : 'hover:bg-[var(--ns-surface-elevated)]'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-medium">{task.title}</td>
                    <td className="py-2.5 px-3 text-[var(--ns-text-muted)]">{PHASE_LABELS[task.phase]}</td>
                    <td className="py-2.5 px-3">{task.responsiblePerson}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-[11px]">
                      {task.startDate} → {task.endDate}
                    </td>
                    <td className="py-2.5 px-3 capitalize">{task.priority}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={
                          task.status === 'done'
                            ? 'text-[var(--ns-success)]'
                            : task.status === 'blocked'
                            ? 'text-[var(--ns-danger)]'
                            : task.status === 'in_progress'
                            ? 'text-[var(--ns-accent-blue)]'
                            : 'text-[var(--ns-text-muted)]'
                        }
                      >
                        {STATUS_LABELS[task.status]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">{task.dependencyIds.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          {(['todo', 'in_progress', 'blocked', 'done'] as ProductionTaskStatus[]).map((statusKey) => {
            const colTasks = tasks.filter((t) => t.status === statusKey);
            return (
              <div
                key={statusKey}
                className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-[var(--ns-border)] pb-2">
                  <span className="font-display font-semibold text-xs">{STATUS_LABELS[statusKey]}</span>
                  <span className="font-mono text-[11px] text-[var(--ns-text-subtle)] tabular-nums">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task) => {
                    const isSel = selected?.id === task.id;
                    return (
                      <div
                        key={task.id}
                        className={`p-2.5 rounded border space-y-1.5 ${
                          isSel
                            ? 'bg-[var(--ns-surface-elevated)] border-[var(--ns-accent)]'
                            : 'bg-[var(--ns-surface-inset)] border-[var(--ns-border)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className="w-full text-left font-medium hover:underline"
                        >
                          {task.title}
                        </button>
                        <div className="text-[11px] text-[var(--ns-text-subtle)] tabular-nums">
                          {PHASE_LABELS[task.phase]} · {task.responsiblePerson}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="font-mono text-[10px] text-[var(--ns-text-muted)] tabular-nums">
                            {task.endDate}
                          </span>
                          <select
                            aria-label={`Change status for ${task.title}`}
                            value={task.status}
                            onChange={(e) =>
                              store.upsertProductionTask({
                                ...task,
                                status: e.target.value as ProductionTaskStatus,
                                updatedAt: new Date().toISOString(),
                              })
                            }
                            className="h-6 px-1.5 rounded bg-[var(--ns-surface)] border border-[var(--ns-border)] text-[11px]"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          {calendarGroups.map(([dateKey, dayTasks]) => (
            <div
              key={dateKey}
              className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between border-b border-[var(--ns-border)] pb-1.5">
                <span className="font-mono font-semibold tabular-nums">{dateKey}</span>
                <span className="text-[11px] text-[var(--ns-text-subtle)] tabular-nums">
                  {dayTasks.length} task(s)
                </span>
              </div>
              <div className="space-y-1.5">
                {dayTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`w-full text-left p-2 rounded border space-y-0.5 ${
                      selected?.id === task.id
                        ? 'bg-[var(--ns-surface-elevated)] border-[var(--ns-accent)]'
                        : 'bg-[var(--ns-surface-inset)] border-[var(--ns-border)]'
                    }`}
                  >
                    <div className="font-medium truncate">{task.title}</div>
                    <div className="text-[11px] text-[var(--ns-text-subtle)] tabular-nums">
                      Due {task.endDate} · {task.responsiblePerson} · {STATUS_LABELS[task.status]}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Lightweight Dependency-Aware Timeline / Gantt */
        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between text-[11px] text-[var(--ns-text-subtle)] border-b border-[var(--ns-border)] pb-2">
            <span>Schedule Span ({tasks.length} milestones)</span>
            <span className="font-mono tabular-nums">
              {new Date(dateBounds.minMs).toISOString().slice(0, 10)} →{' '}
              {new Date(dateBounds.minMs + dateBounds.spanMs).toISOString().slice(0, 10)}
            </span>
          </div>
          <div className="space-y-2.5">
            {tasks.map((task) => {
              const sMs = parseDateMs(task.startDate);
              const eMs = Math.max(parseDateMs(task.endDate), sMs + 86400000);
              const leftPct = Math.max(0, Math.min(92, ((sMs - dateBounds.minMs) / dateBounds.spanMs) * 100));
              const widthPct = Math.max(8, Math.min(100 - leftPct, ((eMs - sMs) / dateBounds.spanMs) * 100));
              const isSel = selected?.id === task.id;
              return (
                <div key={task.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`sm:col-span-4 text-left truncate font-medium ${
                      isSel ? 'text-[var(--ns-accent-blue)]' : ''
                    }`}
                  >
                    {task.title}
                  </button>
                  <div className="sm:col-span-8 h-7 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] relative overflow-hidden">
                    <button
                      type="button"
                      aria-label={`Select timeline bar for ${task.title}`}
                      onClick={() => setSelectedTaskId(task.id)}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`absolute top-1 bottom-1 rounded px-2 text-[10px] font-mono text-white truncate flex items-center ${
                        task.status === 'done'
                          ? 'bg-[var(--ns-success)]'
                          : task.status === 'blocked'
                          ? 'bg-[var(--ns-danger)]'
                          : 'bg-[var(--ns-accent)]'
                      }`}
                    >
                      {task.startDate.slice(5)} → {task.endDate.slice(5)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Task Inspector */}
      {selected && (
        <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ns-border)] pb-3">
            <div>
              <div className="font-mono text-[11px] text-[var(--ns-text-subtle)]">
                {selected.id} · {PHASE_LABELS[selected.phase]}
              </div>
              <h2 className="font-display text-base font-semibold">{selected.title}</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  store.upsertProductionTask({
                    ...selected,
                    status: selected.status === 'done' ? 'todo' : 'done',
                    updatedAt: new Date().toISOString(),
                  })
                }
                className={`h-8 px-3 rounded border font-medium inline-flex items-center gap-1.5 ${
                  selected.status === 'done'
                    ? 'border-[var(--ns-success)] text-[var(--ns-success)] bg-[var(--ns-success)]/10'
                    : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{selected.status === 'done' ? 'Completed' : 'Mark Done'}</span>
              </button>

              {confirmDeleteId === selected.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      store.deleteProductionTask(selected.id);
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
                  aria-label={`Delete task ${selected.title}`}
                  onClick={() => setConfirmDeleteId(selected.id)}
                  className="h-8 px-2.5 rounded border border-[var(--ns-danger)]/40 text-[var(--ns-danger)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Task Title</label>
              <input
                type="text"
                value={selected.title}
                onChange={(e) =>
                  store.upsertProductionTask({
                    ...selected,
                    title: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Production Phase</label>
              <select
                value={selected.phase}
                onChange={(e) =>
                  store.upsertProductionTask({
                    ...selected,
                    phase: e.target.value as ProductionTaskPhase,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="pre_production">Pre-Production</option>
                <option value="production">Production / Generation</option>
                <option value="post_production">Post-Production</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Responsible Person / Crew</label>
              <input
                type="text"
                value={selected.responsiblePerson}
                onChange={(e) =>
                  store.upsertProductionTask({
                    ...selected,
                    responsiblePerson: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Start Date</label>
              <input
                type="date"
                value={selected.startDate}
                onChange={(e) =>
                  store.upsertProductionTask({
                    ...selected,
                    startDate: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">End Date</label>
              <input
                type="date"
                value={selected.endDate}
                onChange={(e) =>
                  store.upsertProductionTask({
                    ...selected,
                    endDate: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Priority</label>
                <select
                  value={selected.priority}
                  onChange={(e) =>
                    store.upsertProductionTask({
                      ...selected,
                      priority: e.target.value as ProductionTask['priority'],
                      updatedAt: new Date().toISOString(),
                    })
                  }
                  className="w-full h-9 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Status</label>
                <select
                  value={selected.status}
                  onChange={(e) =>
                    store.upsertProductionTask({
                      ...selected,
                      status: e.target.value as ProductionTaskStatus,
                      updatedAt: new Date().toISOString(),
                    })
                  }
                  className="w-full h-9 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Linked Scene</label>
              <select
                value={selected.sceneId || ''}
                onChange={(e) =>
                  store.upsertProductionTask({
                    ...selected,
                    sceneId: e.target.value || undefined,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="">None</option>
                {project.scenes.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Linked Shot</label>
              <select
                value={selected.shotId || ''}
                onChange={(e) =>
                  store.upsertProductionTask({
                    ...selected,
                    shotId: e.target.value || undefined,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              >
                <option value="">None</option>
                {(project.shotList || []).map((sh) => (
                  <option key={sh.id} value={sh.id}>
                    Shot {sh.shotNumber} ({sh.shotSize})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[var(--ns-text-muted)]">Notes</label>
              <input
                type="text"
                value={selected.notes || ''}
                onChange={(e) =>
                  store.upsertProductionTask({
                    ...selected,
                    notes: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[var(--ns-text-muted)]">Deliverable Description</label>
            <textarea
              rows={2}
              value={selected.description}
              onChange={(e) =>
                store.upsertProductionTask({
                  ...selected,
                  description: e.target.value,
                  updatedAt: new Date().toISOString(),
                })
              }
              className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
            />
          </div>

          {/* Dependencies */}
          <div className="space-y-1.5">
            <div className="text-[var(--ns-text-muted)] font-medium">
              Prerequisite Tasks ({selected.dependencyIds.length} selected)
            </div>
            <div className="flex flex-wrap gap-2">
              {(project.productionTasks || [])
                .filter((other) => other.id !== selected.id)
                .map((other) => {
                  const checked = selected.dependencyIds.includes(other.id);
                  return (
                    <label
                      key={other.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--ns-border)] bg-[var(--ns-surface-inset)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? selected.dependencyIds.filter((id) => id !== other.id)
                            : [...selected.dependencyIds, other.id];
                          store.upsertProductionTask({
                            ...selected,
                            dependencyIds: next,
                            updatedAt: new Date().toISOString(),
                          });
                        }}
                      />
                      <span>{other.title}</span>
                    </label>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
