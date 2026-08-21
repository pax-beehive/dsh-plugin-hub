export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  const n = Math.floor(value);
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const rounded = n / 1000;
    const text = rounded.toFixed(1);
    return `${text.replace(/\.0$/, "")}k`;
  }
  const rounded = n / 1_000_000;
  const text = rounded >= 10 ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${text.replace(/\.0$/, "")}M`;
}

export const HOT_WEEKLY_DOWNLOADS = 10000;

export function isHotWeeklyDownloads(value: number): boolean {
  return Number.isFinite(value) && value > HOT_WEEKLY_DOWNLOADS;
}
