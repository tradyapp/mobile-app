'use client';

import { List } from 'konsta/react';
import { type EditorNodeField } from '@/modules/tabs/orion/nodesEditorTypes';

function getAttributeTypeIcon(type?: string): string {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized.includes('number') || normalized.includes('int') || normalized.includes('float') || normalized.includes('decimal')) return '#';
  if (normalized.includes('bool')) return '?';
  if (normalized.includes('multi')) return '≡';
  if (normalized.includes('date') || normalized.includes('time')) return '@';
  if (normalized.includes('json') || normalized.includes('object') || normalized.includes('map')) return '{}';
  if (normalized.includes('array') || normalized.includes('list')) return '[]';
  return 'T';
}

function parseMultiSelectCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isReferenceValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().startsWith('ref://node/'));
}

function ConnectorIcon({ connected }: { connected: boolean }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7H7a4 4 0 000 8h2m6-8h2a4 4 0 110 8h-2m-6-3h6" />
      {!connected && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5l14 14" />}
    </svg>
  );
}

interface OrionAttributesPanelProps {
  fields: EditorNodeField[];
  isPreviewMode: boolean;
  timezoneOptions: Array<{ value: string; label: string }>;
  onSetFieldValue: (index: number, value: string) => void;
  onToggleMultiOption: (index: number, optionValue: string) => void;
  onOpenReference: (index: number) => void;
  onClearReference: (index: number) => void;
}

export default function OrionAttributesPanel({
  fields,
  isPreviewMode,
  timezoneOptions,
  onSetFieldValue,
  onToggleMultiOption,
  onOpenReference,
  onClearReference,
}: OrionAttributesPanelProps) {
  if (fields.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-zinc-500">
        No configurable attributes for this node.
      </div>
    );
  }

  return (
    <List strongIos className="[&_.list]:mx-0 [&_.list]:rounded-none [&_.list]:px-0 [&_.list-ios]:mx-0 [&_.list-ios]:rounded-none [&_.list-ios]:px-0">
      {fields.map((field, index) => {
        const fieldType = (field.type || '').trim().toLowerCase();
        const isTimezone = fieldType === 'timezone' || (field.key || '').trim().toLowerCase() === 'timezone';
        const isMultiSelect = fieldType === 'multi_select';
        const selectOptions = field.options && field.options.length > 0 ? field.options : (isTimezone ? timezoneOptions : []);
        const isSelect = !isMultiSelect && selectOptions.length > 0;
        const selectedMultiValues = isMultiSelect ? parseMultiSelectCsv(field.value) : [];
        const connected = isReferenceValue(field.value);

        if (isMultiSelect) {
          return (
            <div key={field.id} className="px-4 py-2">
              <p className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                <span className="text-[10px] font-semibold text-zinc-400">{getAttributeTypeIcon(field.type)}</span>
                <span>{field.name || field.key || 'Attribute'}</span>
                {field.required && <span className="text-red-400">*</span>}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selectOptions.map((option) => {
                  const active = selectedMultiValues.includes(option.value);
                  return (
                    <button
                      key={`${field.id}-${option.value}`}
                      type="button"
                      disabled={isPreviewMode}
                      onClick={() => onToggleMultiOption(index, option.value)}
                      className={`rounded-md border px-1.5 py-1 text-[11px] transition-colors ${active ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200' : 'border-zinc-700 bg-zinc-900 text-zinc-300'} ${isPreviewMode ? 'opacity-60' : ''}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        return (
          <div key={field.id} className="px-4 py-2">
            <p className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
              <span className="text-[10px] font-semibold text-zinc-400">{getAttributeTypeIcon(field.type)}</span>
              <span>{field.name || field.key || 'Attribute'}</span>
              {field.required && <span className="text-red-400">*</span>}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              {isSelect ? (
                <select
                  value={field.value ?? ''}
                  disabled={isPreviewMode}
                  onChange={(event) => onSetFieldValue(index, event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-xs text-zinc-100 outline-none"
                >
                  {selectOptions.map((option) => (
                    <option key={`${field.id}-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={field.value ?? ''}
                  disabled={isPreviewMode}
                  placeholder="Set value"
                  onChange={(event) => onSetFieldValue(index, event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-xs text-zinc-100 outline-none"
                />
              )}
              <button
                type="button"
                disabled={isPreviewMode}
                onClick={() => onOpenReference(index)}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-[10px] font-semibold text-zinc-200 disabled:opacity-60"
              >
                <ConnectorIcon connected={connected} />
                {connected ? 'Connected' : 'Connect'}
              </button>
              {connected && (
                <button
                  type="button"
                  disabled={isPreviewMode}
                  onClick={() => onClearReference(index)}
                  className="inline-flex h-7 shrink-0 items-center rounded-md border border-zinc-700 bg-zinc-900 px-2 text-[10px] font-semibold text-zinc-300 disabled:opacity-60"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        );
      })}
    </List>
  );
}
