/**
 * Small shared summary helpers for the diagnostics path.
 *
 * The Mac computes its own figures in Swift (`LatencyMonitor`); this is the
 * matching implementation for the numbers the phone measures itself, kept
 * here so both sides agree on what "p95" means.
 */

/**
 * Nearest-rank percentile of an unsorted sample set, `p` in 0…1.
 *
 * Returns 0 for an empty set — a missing measurement reads better as a zero
 * in the UI than as a dash that has to be special-cased everywhere.
 */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const clamped = Math.min(1, Math.max(0, p));
  const rank = Math.ceil(clamped * sorted.length);
  return sorted[Math.max(0, rank - 1)];
}

export interface Summary {
  p50: number;
  p95: number;
  count: number;
}

export function summarize(samples: number[]): Summary {
  return {
    p50: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
    count: samples.length,
  };
}
