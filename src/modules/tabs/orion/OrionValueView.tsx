/* eslint-disable @next/next/no-img-element */
'use client';

export function formatScalarValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return Object.prototype.toString.call(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCandleLikeObject(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  const hasDateTime = typeof value.datetime === 'string';
  const hasOpen = typeof value.open === 'number';
  const hasHigh = typeof value.high === 'number';
  const hasLow = typeof value.low === 'number';
  const hasClose = typeof value.close === 'number';
  return hasDateTime && hasOpen && hasHigh && hasLow && hasClose;
}

export type OrionValueType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object' | 'candle' | 'candle_array' | 'unknown';

export function getValueType(value: unknown): OrionValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((item) => isCandleLikeObject(item))) return 'candle_array';
    return 'array';
  }
  if (isCandleLikeObject(value)) return 'candle';
  if (isPlainObject(value)) return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'unknown';
}

export function getTypeToken(type: ReturnType<typeof getValueType>): { icon: string; pillClass: string; typeLabel: string } {
  if (type === 'candle_array') return { icon: 'C[]', pillClass: 'border-teal-700 bg-teal-900/45 text-teal-200', typeLabel: 'candle[]' };
  if (type === 'candle') return { icon: 'C', pillClass: 'border-cyan-700 bg-cyan-900/45 text-cyan-200', typeLabel: 'candle' };
  if (type === 'string') return { icon: 'T', pillClass: 'border-sky-700 bg-sky-900/45 text-sky-200', typeLabel: 'string' };
  if (type === 'number') return { icon: '#', pillClass: 'border-emerald-700 bg-emerald-900/45 text-emerald-200', typeLabel: 'number' };
  if (type === 'boolean') return { icon: '?', pillClass: 'border-amber-700 bg-amber-900/45 text-amber-200', typeLabel: 'boolean' };
  if (type === 'null') return { icon: '0', pillClass: 'border-zinc-700 bg-zinc-800/70 text-zinc-200', typeLabel: 'null' };
  if (type === 'array') return { icon: '[]', pillClass: 'border-violet-700 bg-violet-900/45 text-violet-200', typeLabel: 'array' };
  if (type === 'object') return { icon: '{}', pillClass: 'border-rose-700 bg-rose-900/45 text-rose-200', typeLabel: 'object' };
  return { icon: '·', pillClass: 'border-zinc-700 bg-zinc-800/70 text-zinc-200', typeLabel: 'unknown' };
}

export function SymbolAvatar({ iconUrl, ticker }: { iconUrl?: string | null; ticker: string }) {
  if (iconUrl) {
    return <img src={iconUrl} alt={ticker} className="h-9 w-9 rounded-md object-cover" />;
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-[10px] font-semibold text-zinc-300">
      {ticker.slice(0, 3)}
    </div>
  );
}

export function SnapshotTree({
  label,
  value,
  depth = 0,
}: {
  label: string;
  value: unknown;
  depth?: number;
}) {
  const isArray = Array.isArray(value);
  const isObject = isPlainObject(value);
  const isBranch = isArray || isObject;
  const valueType = getValueType(value);
  const token = getTypeToken(valueType);

  if (!isBranch) {
    return (
      <div className="mt-1 flex flex-wrap items-start gap-2 py-1.5">
        <span className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${token.pillClass}`}>
          <span className="inline-flex h-4 min-w-4 items-center justify-center px-0.5 text-[9px] font-semibold opacity-80">
            {token.icon}
          </span>
          <span>
            {label}
          </span>
        </span>
        <p className="min-w-0 max-w-full break-words text-[11px] text-zinc-100">{formatScalarValue(value)}</p>
      </div>
    );
  }

  const entries = isArray
    ? value.map((item, index) => [`[${index}]`, item] as const)
    : Object.entries(value);

  return (
    <details
      className="mt-1"
      open={depth < 2}
    >
      <summary className="cursor-pointer py-1.5 text-[11px] font-semibold text-zinc-100 marker:text-zinc-500">
        <span className="inline-flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${token.pillClass}`}>
            <span className="inline-flex h-4 min-w-4 items-center justify-center px-0.5 text-[9px] font-semibold opacity-80">
              {token.icon}
            </span>
            {label}
          </span>
          <span className="text-zinc-500">({entries.length})</span>
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] ${token.pillClass}`}>{token.typeLabel}</span>
        </span>
      </summary>
      <div className="ml-4 space-y-0.5 pl-2">
        {entries.length === 0 ? (
          <div className="py-1.5 text-[11px] text-zinc-500">
            Empty
          </div>
        ) : (
          entries.map(([entryKey, entryValue]) => (
            <SnapshotTree key={`${label}-${entryKey}`} label={entryKey} value={entryValue} depth={depth + 1} />
          ))
        )}
      </div>
    </details>
  );
}
