import { CCCResult, RecommendationCandidate } from '@/lib/ccc-engine/types';

export interface RecommendationRule {
  id: string;
  dimension: 'DIO' | 'DSO' | 'DPO';
  priority: number; // 1-10
  condition: (result: CCCResult) => boolean;
  titleTemplate: (result: CCCResult) => string;
  estimatedDaysTemplate: (result: CCCResult) => number;
}

/**
 * Layer 1: Rule Engine - All rules run client-side
 */
const LAYER1_RULES: RecommendationRule[] = [
  {
    id: 'R1',
    dimension: 'DSO',
    priority: 9,
    condition: (result) => result.dso.value > result.dso.benchmark + 10,
    titleTemplate: (result) => 
      `Reduce DSO from ${result.dso.value.toFixed(1)} to ${result.dso.benchmark} days`,
    estimatedDaysTemplate: (result) => result.dso.value - result.dso.benchmark,
  },
  {
    id: 'R2',
    dimension: 'DIO',
    priority: 8,
    condition: (result) => result.dio.value > result.dio.benchmark + 5,
    titleTemplate: (result) => 
      `Optimize inventory turnover from ${result.dio.value.toFixed(1)} to ${result.dio.benchmark} days`,
    estimatedDaysTemplate: (result) => result.dio.value - result.dio.benchmark,
  },
  {
    id: 'R3',
    dimension: 'DPO',
    priority: 7,
    condition: (result) => result.dpo.value < result.dpo.benchmark - 5,
    titleTemplate: (result) => 
      `Extend payment terms from ${result.dpo.value.toFixed(1)} to ${result.dpo.benchmark} days`,
    estimatedDaysTemplate: (result) => result.dpo.benchmark - result.dpo.value,
  },
  {
    id: 'R4',
    dimension: 'DSO',
    priority: 8,
    condition: (result) => result.dso.value > result.dso.benchmark * 1.5,
    titleTemplate: (result) => 
      `Critical: DSO severely elevated at ${result.dso.value.toFixed(1)} days`,
    estimatedDaysTemplate: (result) => result.dso.value - result.dso.benchmark,
  },
  {
    id: 'R5',
    dimension: 'DIO',
    priority: 6,
    condition: (result) => result.dio.value > result.dio.benchmark * 1.3,
    titleTemplate: (result) => 
      `High inventory carrying costs: DIO at ${result.dio.value.toFixed(1)} days`,
    estimatedDaysTemplate: (result) => result.dio.value - result.dio.benchmark,
  },
  {
    id: 'R6',
    dimension: 'DPO',
    priority: 5,
    condition: (result) => result.dpo.value < result.dpo.benchmark * 0.7,
    titleTemplate: (result) => 
      `Payment terms too aggressive at ${result.dpo.value.toFixed(1)} days`,
    estimatedDaysTemplate: (result) => result.dpo.benchmark - result.dpo.value,
  },
  {
    id: 'R7',
    dimension: 'CCC',
    priority: 9,
    condition: (result) => result.ccc > result.benchmarkCCC + 20,
    titleTemplate: (result) => 
      `CCC gap of ${result.gapDays.toFixed(1)} days - prioritize working capital improvements`,
    estimatedDaysTemplate: (result) => result.gapDays,
  },
  {
    id: 'R8',
    dimension: 'DSO',
    priority: 7,
    condition: (result) => result.dso.trendDelta > 5,
    titleTemplate: (result) => 
      `DSO trending upward by ${result.dso.trendDelta} days - investigate collection delays`,
    estimatedDaysTemplate: (result) => result.dso.trendDelta,
  },
];

/**
 * Evaluate all Layer 1 rules against a CCC result
 */
export function evaluateLayer1(result: CCCResult): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = LAYER1_RULES
    .filter((rule) => rule.condition(result))
    .map((rule) => ({
      id: rule.id,
      dimension: rule.dimension,
      priority: rule.priority,
      title: rule.titleTemplate(result),
      estimatedDays: rule.estimatedDaysTemplate(result),
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8); // Max 8 candidates for Layer 2

  return candidates;
}
