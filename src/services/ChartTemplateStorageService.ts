import type { ChartTemplate, ChartPreferences } from "@/stores/chartSettingsStore";

export type Unsubscribe = () => void;

type TemplatesListener = (templates: ChartTemplate[]) => void;
type ActiveListener = (id: string | null) => void;
type PrefsListener = (prefs: ChartPreferences | null) => void;

const KEY_TEMPLATES = "trady:chart:templates";
const KEY_ACTIVE = "trady:chart:active-template";
const KEY_PREFS = "trady:chart:preferences";

const templateListeners = new Set<TemplatesListener>();
const activeListeners = new Set<ActiveListener>();
const prefsListeners = new Set<PrefsListener>();

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function emitTemplates() {
  const templates = readJson<ChartTemplate[]>(KEY_TEMPLATES, []);
  templateListeners.forEach((fn) => fn(templates));
}

function emitActive() {
  const active = readJson<string | null>(KEY_ACTIVE, null);
  activeListeners.forEach((fn) => fn(active));
}

function emitPrefs() {
  const prefs = readJson<ChartPreferences | null>(KEY_PREFS, null);
  prefsListeners.forEach((fn) => fn(prefs));
}

export class ChartTemplateStorageService {
  static subscribeTemplates(onTemplates: TemplatesListener): Unsubscribe {
    templateListeners.add(onTemplates);
    onTemplates(readJson<ChartTemplate[]>(KEY_TEMPLATES, []));
    return () => templateListeners.delete(onTemplates);
  }

  static subscribeActiveTemplate(onActiveId: ActiveListener): Unsubscribe {
    activeListeners.add(onActiveId);
    onActiveId(readJson<string | null>(KEY_ACTIVE, null));
    return () => activeListeners.delete(onActiveId);
  }

  static async save(template: ChartTemplate): Promise<void> {
    const templates = readJson<ChartTemplate[]>(KEY_TEMPLATES, []);
    const idx = templates.findIndex((t) => t.id === template.id);
    if (idx >= 0) templates[idx] = template;
    else templates.push(template);
    writeJson(KEY_TEMPLATES, templates);
    emitTemplates();
  }

  static async remove(id: string): Promise<void> {
    const templates = readJson<ChartTemplate[]>(KEY_TEMPLATES, []).filter((t) => t.id !== id);
    writeJson(KEY_TEMPLATES, templates);
    emitTemplates();
  }

  static async setActiveTemplate(id: string): Promise<void> {
    writeJson(KEY_ACTIVE, id);
    emitActive();
  }

  static subscribePreferences(onPrefs: PrefsListener): Unsubscribe {
    prefsListeners.add(onPrefs);
    onPrefs(readJson<ChartPreferences | null>(KEY_PREFS, null));
    return () => prefsListeners.delete(onPrefs);
  }

  static async setPreferences(prefs: ChartPreferences): Promise<void> {
    writeJson(KEY_PREFS, prefs);
    emitPrefs();
  }
}
