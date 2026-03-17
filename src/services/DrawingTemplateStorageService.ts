import type { DrawingTemplate, DefaultDrawingTemplateIds } from "@/stores/drawingTemplateStore";

export type Unsubscribe = () => void;

const KEY_TEMPLATES = "trady:drawing:templates";
const KEY_DEFAULTS = "trady:drawing:defaults";

type TemplateListener = (templates: DrawingTemplate[]) => void;
type DefaultsListener = (defaults: DefaultDrawingTemplateIds | null) => void;

const templateListeners = new Set<TemplateListener>();
const defaultListeners = new Set<DefaultsListener>();

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
  const templates = readJson<DrawingTemplate[]>(KEY_TEMPLATES, []);
  templateListeners.forEach((fn) => fn(templates));
}

function emitDefaults() {
  const defaults = readJson<DefaultDrawingTemplateIds | null>(KEY_DEFAULTS, null);
  defaultListeners.forEach((fn) => fn(defaults));
}

export class DrawingTemplateStorageService {
  static subscribeTemplates(onTemplates: TemplateListener): Unsubscribe {
    templateListeners.add(onTemplates);
    onTemplates(readJson<DrawingTemplate[]>(KEY_TEMPLATES, []));
    return () => templateListeners.delete(onTemplates);
  }

  static subscribeDefaultTemplates(onDefaults: DefaultsListener): Unsubscribe {
    defaultListeners.add(onDefaults);
    onDefaults(readJson<DefaultDrawingTemplateIds | null>(KEY_DEFAULTS, null));
    return () => defaultListeners.delete(onDefaults);
  }

  static async save(template: DrawingTemplate): Promise<void> {
    const templates = readJson<DrawingTemplate[]>(KEY_TEMPLATES, []);
    const idx = templates.findIndex((t) => t.id === template.id);
    if (idx >= 0) templates[idx] = template;
    else templates.push(template);
    writeJson(KEY_TEMPLATES, templates);
    emitTemplates();
  }

  static async remove(id: string): Promise<void> {
    const templates = readJson<DrawingTemplate[]>(KEY_TEMPLATES, []).filter((t) => t.id !== id);
    writeJson(KEY_TEMPLATES, templates);
    emitTemplates();
  }

  static async setDefaultTemplate(category: string, id: string): Promise<void> {
    const current = readJson<Record<string, string>>(KEY_DEFAULTS, {});
    const next = { ...current, [category]: id };
    writeJson(KEY_DEFAULTS, next);
    emitDefaults();
  }
}
