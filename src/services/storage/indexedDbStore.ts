import {
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_TASK_ROUTING_RULES,
  sanitizeSettingsForClientExport,
} from '../../modules/ai-orchestration/orchestratorRules';
import { migrateProjectSchema } from '../../modules/persistence/projectMigration';
import type { Project, StudioSettings } from '../../types/studio';

const DB_NAME = 'neural_symphony_studio_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_META = 'meta';

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  theme: 'dark',
  comfyUiUrl: 'http://127.0.0.1:8188',
  comfyTimeoutMs: 8000,
  qwenVlEndpointUrl: '',
  qwenVlModelId: 'Qwen/Qwen2.5-VL-3B-Instruct',
  geminiModel: 'gemini-4-hydrogen',
  ffmpegServiceUrl: '',
  defaultEngine: 'ltx-video',
  autosaveSeconds: 3,
  allowOfflineSimulation: true,
  aiProviders: DEFAULT_AI_PROVIDERS,
  aiModels: DEFAULT_AI_MODELS,
  routingRules: DEFAULT_TASK_ROUTING_RULES,
  routingPriority: 'quality',
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function loadAllProjects(): Promise<Project[]> {
  try {
    const db = await openDb();
    const list = await new Promise<Project[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as Project[]) || []);
      req.onerror = () => reject(req.error);
    });
    return list.map(migrateProjectSchema);
  } catch {
    try {
      const raw = localStorage.getItem('ns_projects_fallback');
      const parsed = raw ? (JSON.parse(raw) as Project[]) : [];
      return parsed.map(migrateProjectSchema);
    } catch {
      return [];
    }
  }
}

export async function saveProjectRecord(project: Project): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).put(project);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await loadAllProjects();
    const updated = existing.some((p) => p.id === project.id)
      ? existing.map((p) => (p.id === project.id ? project : p))
      : [...existing, project];
    localStorage.setItem('ns_projects_fallback', JSON.stringify(updated));
  }
}

export async function deleteProjectRecord(projectId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).delete(projectId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await loadAllProjects();
    localStorage.setItem(
      'ns_projects_fallback',
      JSON.stringify(existing.filter((p) => p.id !== projectId))
    );
  }
}

export async function loadStudioSettings(): Promise<StudioSettings> {
  try {
    const db = await openDb();
    const record = await new Promise<{ key: string; value: StudioSettings } | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('studio_settings');
      req.onsuccess = () => resolve(req.result as { key: string; value: StudioSettings } | undefined);
      req.onerror = () => reject(req.error);
    });
    const merged = record?.value ? { ...DEFAULT_STUDIO_SETTINGS, ...record.value } : DEFAULT_STUDIO_SETTINGS;
    return {
      ...merged,
      aiProviders: merged.aiProviders?.length ? merged.aiProviders : DEFAULT_AI_PROVIDERS,
      aiModels: merged.aiModels?.length ? merged.aiModels : DEFAULT_AI_MODELS,
      routingRules: merged.routingRules?.length ? merged.routingRules : DEFAULT_TASK_ROUTING_RULES,
      routingPriority: merged.routingPriority || 'quality',
    };
  } catch {
    const raw = localStorage.getItem('ns_studio_settings');
    return raw ? { ...DEFAULT_STUDIO_SETTINGS, ...JSON.parse(raw) } : DEFAULT_STUDIO_SETTINGS;
  }
}

export async function saveStudioSettings(settings: StudioSettings): Promise<void> {
  const sanitized = sanitizeSettingsForClientExport(settings);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key: 'studio_settings', value: sanitized });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem('ns_studio_settings', JSON.stringify(sanitized));
  }
}

export async function saveActiveProjectId(projectId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key: 'active_project_id', value: projectId });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem('ns_active_project_id', projectId);
  }
}

export async function loadActiveProjectId(): Promise<string | null> {
  try {
    const db = await openDb();
    const record = await new Promise<{ key: string; value: string } | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get('active_project_id');
      req.onsuccess = () => resolve(req.result as { key: string; value: string } | undefined);
      req.onerror = () => reject(req.error);
    });
    return record?.value || null;
  } catch {
    return localStorage.getItem('ns_active_project_id');
  }
}
