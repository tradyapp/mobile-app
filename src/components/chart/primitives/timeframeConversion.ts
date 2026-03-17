import type { SymbolType } from '@/stores/chartStore';

/**
 * Bar weight in minutes (or equivalent trading minutes for d/w/mo).
 * Used to convert logicalOffset values between timeframes.
 */
const STOCK_BAR_WEIGHT: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  h: 60,
  d: 420,    // 7 × 60  (6.5h trading day)
  w: 2100,   // 5 × 420
  mo: 8400,  // 20 × 420
};

const CRYPTO_BAR_WEIGHT: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  h: 60,
  d: 1440,   // 24 × 60
  w: 10080,  // 7 × 1440
  mo: 43200, // 30 × 1440
};

const FOREX_BAR_WEIGHT: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  h: 60,
  d: 1440,   // 24 × 60
  w: 7200,   // 5 × 1440
  mo: 31680, // 22 × 1440
};

const BAR_WEIGHTS: Record<SymbolType, Record<string, number>> = {
  STOCK: STOCK_BAR_WEIGHT,
  CRYPTO: CRYPTO_BAR_WEIGHT,
  FOREX: FOREX_BAR_WEIGHT,
};

export function getTimeframeConversionFactor(
  sourceTF: string,
  targetTF: string,
  symbolType: SymbolType,
): number {
  if (sourceTF === targetTF) return 1;

  const weights = BAR_WEIGHTS[symbolType];
  const sourceWeight = weights[sourceTF];
  const targetWeight = weights[targetTF];

  if (!sourceWeight || !targetWeight) return 1;

  return sourceWeight / targetWeight;
}

/**
 * Snap a datetime string to the candle boundary of the target timeframe.
 * Works with pure string/number parsing — no Date.parse — to avoid timezone issues.
 *
 * Input formats accepted:
 *   "YYYY-MM-DD HH:mm:00"  (intraday)
 *   "YYYY-MM-DD"            (daily+)
 *
 * Returns the datetime string that matches the candle key in that timeframe.
 */
export function snapDatetimeToTimeframe(datetime: string, targetTF: string): string {
  // Parse components from the datetime string
  const year = parseInt(datetime.slice(0, 4), 10);
  const month = parseInt(datetime.slice(5, 7), 10); // 1-12
  const day = parseInt(datetime.slice(8, 10), 10);

  const hasTime = datetime.length > 10;
  const hour = hasTime ? parseInt(datetime.slice(11, 13), 10) : 0;
  const minute = hasTime ? parseInt(datetime.slice(14, 16), 10) : 0;

  const pad2 = (n: number) => n.toString().padStart(2, '0');

  if (targetTF === 'mo') {
    return `${year}-${pad2(month)}-01`;
  }

  if (targetTF === 'w') {
    // Find Monday of the week containing this date.
    // Use a known reference: 2026-01-05 is a Monday (epoch-independent).
    // Compute day-of-week via days since that reference.
    const daysSinceRef = daysBetween(2026, 1, 5, year, month, day);
    // mod 7: 0=Mon, 1=Tue, …, 6=Sun
    let dow = daysSinceRef % 7;
    if (dow < 0) dow += 7;
    const mondayDay = day - dow;
    // Normalize in case it rolls back to previous month
    const date = new Date(Date.UTC(year, month - 1, mondayDay));
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  }

  if (targetTF === 'd') {
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // Intraday timeframes
  let intervalMinutes: number;
  switch (targetTF) {
    case '1m':  intervalMinutes = 1; break;
    case '5m':  intervalMinutes = 5; break;
    case '15m': intervalMinutes = 15; break;
    case '30m': intervalMinutes = 30; break;
    case 'h':   intervalMinutes = 60; break;
    default:    return datetime; // unknown TF, return as-is
  }

  const totalMinutes = hour * 60 + minute;
  const snapped = Math.floor(totalMinutes / intervalMinutes) * intervalMinutes;
  const newHour = Math.floor(snapped / 60);
  const newMinute = snapped % 60;

  return `${year}-${pad2(month)}-${pad2(day)} ${pad2(newHour)}:${pad2(newMinute)}:00`;
}

/** Count days from (y1,m1,d1) to (y2,m2,d2) using UTC Date subtraction. */
function daysBetween(y1: number, m1: number, d1: number, y2: number, m2: number, d2: number): number {
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((ms2 - ms1) / 86400000);
}
