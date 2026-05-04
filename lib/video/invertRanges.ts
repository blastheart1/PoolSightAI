import type { TimeRange } from "@/lib/audio/silenceSegments";

/**
 * Given total duration and ranges to remove, returns the time ranges to keep.
 */
export function invertRanges(totalDuration: number, removeRanges: TimeRange[]): TimeRange[] {
  if (removeRanges.length === 0) return [{ start: 0, end: totalDuration }];

  const sorted = [...removeRanges]
    .map((r) => ({ start: Math.max(0, r.start), end: Math.min(totalDuration, r.end) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);

  // Merge overlapping / adjacent ranges to avoid zero-length keep-ranges
  const merged: TimeRange[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, r.end) };
    } else {
      merged.push({ ...r });
    }
  }

  const keep: TimeRange[] = [];
  let cursor = 0;

  for (const { start, end } of merged) {
    if (cursor < start) keep.push({ start: cursor, end: start });
    cursor = Math.max(cursor, end);
  }

  if (cursor < totalDuration) keep.push({ start: cursor, end: totalDuration });

  return keep;
}
