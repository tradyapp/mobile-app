export function formatCurrency(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}%`;
}

export function pnlColor(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-zinc-400";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-zinc-400";
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (Math.abs(diffSec) < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function statusColor(status: string): string {
  switch (status) {
    case "completed": return "bg-emerald-600/30 text-emerald-300 border-emerald-700/40";
    case "open": return "bg-sky-600/30 text-sky-300 border-sky-700/40";
    case "canceled": return "bg-zinc-600/30 text-zinc-300 border-zinc-700/40";
    case "declined": return "bg-rose-600/30 text-rose-300 border-rose-700/40";
    default: return "bg-zinc-600/30 text-zinc-300 border-zinc-700/40";
  }
}

export function sideColor(side: string): string {
  return side === "buy" ? "text-emerald-400" : "text-rose-400";
}
