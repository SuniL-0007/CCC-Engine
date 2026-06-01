import type { CCCResult, Layer1Candidate } from '@/lib/ccc-engine/types';

interface RecommendationRule {
  id: string;
  dimension: 'DIO' | 'DSO' | 'DPO';
  basePriority: number;
  condition: (result: CCCResult) => boolean;
  title: (result: CCCResult) => string;
  estimatedDays: (result: CCCResult) => number;
}

const RULES: RecommendationRule[] = [
  {
    id: 'R1',
    dimension: 'DSO',
    basePriority: 9,
    condition: (result) => result.dso.value > result.dso.benchmark + 10,
    title: () => 'Chase overdue AR invoices immediately',
    estimatedDays: (result) => Math.round(result.dso.gapDays * 0.6),
  },
  {
    id: 'R2',
    dimension: 'DSO',
    basePriority: 8,
    condition: (result) => result.dso.value > result.dso.benchmark + 5,
    title: () => 'Introduce payment reminders for buyers',
    estimatedDays: (result) => Math.round(result.dso.gapDays * 0.4),
  },
  {
    id: 'R3',
    dimension: 'DIO',
    basePriority: 8,
    condition: (result) => result.dio.value > result.dio.benchmark + 15,
    title: () => 'Reduce slow-moving fabric inventory',
    estimatedDays: (result) => Math.round(result.dio.gapDays * 0.5),
  },
  {
    id: 'R4',
    dimension: 'DIO',
    basePriority: 6,
    condition: (result) => result.dio.value > result.dio.benchmark + 5,
    title: () => 'Tighten fabric reorder points',
    estimatedDays: (result) => Math.round(result.dio.gapDays * 0.3),
  },
  {
    id: 'R5',
    dimension: 'DPO',
    basePriority: 7,
    condition: (result) => result.dpo.value < result.dpo.benchmark - 10,
    title: () => 'Negotiate extended vendor payment terms',
    estimatedDays: (result) => Math.round(Math.abs(result.dpo.gapDays) * 0.5),
  },
  {
    id: 'R6',
    dimension: 'DPO',
    basePriority: 5,
    condition: (result) => result.dpo.value < result.dpo.benchmark - 5,
    title: () => 'Request Net 45 from top 3 suppliers',
    estimatedDays: (result) => Math.round(Math.abs(result.dpo.gapDays) * 0.3),
  },
  {
    id: 'R7',
    dimension: 'DSO',
    basePriority: 4,
    condition: (result) => result.dso.gapDays > 0 && result.dio.gapDays > 0,
    title: () => 'Introduce advance payment policy for new buyers',
    estimatedDays: () => 5,
  },
  {
    id: 'R8',
    dimension: 'DIO',
    basePriority: 3,
    condition: (result) => result.dio.value > result.dio.benchmark,
    title: () => 'Review procurement forecast accuracy',
    estimatedDays: () => 3,
  },
];

export function evaluateLayer1(cccResult: CCCResult): Layer1Candidate[] {
  return RULES
    .filter((rule) => rule.condition(cccResult))
    .sort((a, b) => b.basePriority - a.basePriority)
    .slice(0, 8)
    .map((rule) => ({
      id: rule.id,
      dimension: rule.dimension,
      priority: rule.basePriority,
      title: rule.title(cccResult),
      estimatedDaysReduction: rule.estimatedDays(cccResult),
    }));
}
