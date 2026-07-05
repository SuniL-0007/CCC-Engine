export interface ComponentResult {
  value: number;
  benchmark: number;
  gapDays: number;
  trendDelta: number;
  dataCompleteness: number;
}

export interface CCCResult {
  dio: ComponentResult;
  dso: ComponentResult;
  dpo: ComponentResult;
  ccc: number;
  benchmarkCCC: number;
  gapDays: number;
  periodDays: number;
  calculatedAt: Date;
  /** Actual daily revenue (in lakhs) derived from the uploaded Sales Register; absent when revenue could not be read. */
  dailyRevenueLakhs?: number;
}

export interface Layer1Candidate {
  id: string;
  dimension: 'DIO' | 'DSO' | 'DPO';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  explanation: string;
  actionSteps: string[];
  estimatedDaysReduction: number;
  estimatedCashFreedLakhs: number;
}

export interface Recommendation {
  id: string;
  dimension: 'DIO' | 'DSO' | 'DPO';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  explanation: string;
  actionSteps: string[];
  estimatedDaysReduction: number;
  estimatedCashFreedLakhs: number;
}
