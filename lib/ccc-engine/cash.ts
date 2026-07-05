import type { CCCResult } from './types';

// Used only when the uploaded files contain no revenue to derive a real figure from.
const FALLBACK_DAILY_REVENUE_LAKHS = 5;

export function getDailyRevenueLakhs(result: Pick<CCCResult, 'dailyRevenueLakhs'>): number {
  const daily = result.dailyRevenueLakhs;
  return typeof daily === 'number' && Number.isFinite(daily) && daily > 0
    ? daily
    : FALLBACK_DAILY_REVENUE_LAKHS;
}

/** Working capital locked (vs benchmark), in lakhs. 0 when at or below benchmark. */
export function estimateCashLockedLakhs(result: CCCResult): number {
  return roundLakhs(Math.max(result.gapDays, 0) * getDailyRevenueLakhs(result));
}

/** Cash released by shaving `daysReduction` days off the cycle, in lakhs. */
export function estimateCashFreedLakhs(
  daysReduction: number,
  result: Pick<CCCResult, 'dailyRevenueLakhs'>
): number {
  return roundLakhs(Math.max(daysReduction, 0) * getDailyRevenueLakhs(result));
}

function roundLakhs(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;
}
