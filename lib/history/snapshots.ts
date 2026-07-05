import type { CCCResult } from '@/lib/ccc-engine/types';

const STORAGE_KEY = 'fabriccash:snapshots';
const MAX_SNAPSHOTS = 24;

export interface StoredSnapshot {
  id: string;
  createdAt: string; // ISO timestamp
  periodDays: number;
  dio: number;
  dso: number;
  dpo: number;
  ccc: number;
  gapDays: number;
  dailyRevenueLakhs?: number;
}

export function loadSnapshots(): StoredSnapshot[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isStoredSnapshot);
  } catch {
    return [];
  }
}

export function saveSnapshot(result: CCCResult): StoredSnapshot {
  const snapshot: StoredSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: result.calculatedAt.toISOString(),
    periodDays: result.periodDays,
    dio: result.dio.value,
    dso: result.dso.value,
    dpo: result.dpo.value,
    ccc: result.ccc,
    gapDays: result.gapDays,
    ...(result.dailyRevenueLakhs !== undefined
      ? { dailyRevenueLakhs: result.dailyRevenueLakhs }
      : {}),
  };

  if (typeof window !== 'undefined') {
    try {
      const history = [snapshot, ...loadSnapshots()].slice(0, MAX_SNAPSHOTS);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Storage full or unavailable — the analysis itself still works.
    }
  }

  return snapshot;
}

/**
 * Fills in trendDelta on each component by comparing against the most recent
 * prior snapshot. Positive delta = the metric grew since the last run.
 */
export function applyTrends(result: CCCResult, previous: StoredSnapshot | null): CCCResult {
  if (!previous) return result;

  return {
    ...result,
    dio: { ...result.dio, trendDelta: roundDelta(result.dio.value - previous.dio) },
    dso: { ...result.dso, trendDelta: roundDelta(result.dso.value - previous.dso) },
    dpo: { ...result.dpo, trendDelta: roundDelta(result.dpo.value - previous.dpo) },
  };
}

export function latestSnapshot(): StoredSnapshot | null {
  return loadSnapshots()[0] ?? null;
}

export function clearSnapshots(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function roundDelta(value: number): number {
  return Math.round(value * 10) / 10;
}

function isStoredSnapshot(entry: unknown): entry is StoredSnapshot {
  if (typeof entry !== 'object' || entry === null) return false;
  const candidate = entry as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.dio === 'number' &&
    typeof candidate.dso === 'number' &&
    typeof candidate.dpo === 'number' &&
    typeof candidate.ccc === 'number'
  );
}
