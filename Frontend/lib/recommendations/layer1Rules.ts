import {
  CCCResult,
  CompanyContext,
  MetricDimension,
  Recommendation,
  RecommendationCandidate,
} from '@/lib/ccc-engine/types';

export interface RecommendationRule {
  id: string;
  dimension: MetricDimension;
  priority: number;
  condition: (result: CCCResult, context: CompanyContext) => boolean;
  titleTemplate: (result: CCCResult) => string;
  estimatedDaysTemplate: (result: CCCResult) => number;
}

const PEAK_INVENTORY_MONTHS = new Set([9, 10, 11]);

const LAYER1_RULES: RecommendationRule[] = [
  {
    id: 'R1',
    dimension: 'DSO',
    priority: 9,
    condition: (result) => result.dso.value > result.dso.benchmark + 10,
    titleTemplate: (result) =>
      `Collect customer payments ${formatDays(result.dso.value - result.dso.benchmark)} faster`,
    estimatedDaysTemplate: (result) => result.dso.value - result.dso.benchmark,
  },
  {
    id: 'R2',
    dimension: 'DIO',
    priority: 8,
    condition: (result, context) =>
      result.dio.value > result.dio.benchmark + 5 && !PEAK_INVENTORY_MONTHS.has(context.month),
    titleTemplate: (result) =>
      `Reduce inventory holding by ${formatDays(result.dio.value - result.dio.benchmark)}`,
    estimatedDaysTemplate: (result) => result.dio.value - result.dio.benchmark,
  },
  {
    id: 'R3',
    dimension: 'DPO',
    priority: 7,
    condition: (result) => result.dpo.value < result.dpo.benchmark - 5,
    titleTemplate: (result) =>
      `Move supplier payments closer to the ${result.dpo.benchmark}-day benchmark`,
    estimatedDaysTemplate: (result) => result.dpo.benchmark - result.dpo.value,
  },
  {
    id: 'R4',
    dimension: 'DSO',
    priority: 8,
    condition: (result) => result.dso.value > result.dso.benchmark * 1.5,
    titleTemplate: (result) => `Prioritise overdue receivables at ${result.dso.value.toFixed(1)} DSO days`,
    estimatedDaysTemplate: (result) => result.dso.value - result.dso.benchmark,
  },
  {
    id: 'R5',
    dimension: 'DIO',
    priority: 6,
    condition: (result, context) =>
      result.dio.value > result.dio.benchmark * 1.3 && !PEAK_INVENTORY_MONTHS.has(context.month),
    titleTemplate: () => `Separate slow-moving stock from fast-selling fabric`,
    estimatedDaysTemplate: (result) => result.dio.value - result.dio.benchmark,
  },
  {
    id: 'R6',
    dimension: 'DPO',
    priority: 5,
    condition: (result) => result.dpo.value < result.dpo.benchmark * 0.7,
    titleTemplate: () => `Stop paying vendors much earlier than the market norm`,
    estimatedDaysTemplate: (result) => result.dpo.benchmark - result.dpo.value,
  },
  {
    id: 'R7',
    dimension: 'CCC',
    priority: 9,
    condition: (result) => result.ccc > result.benchmarkCCC + 20,
    titleTemplate: (result) => `Close the ${formatDays(result.gapDays)} cash-cycle gap`,
    estimatedDaysTemplate: (result) => result.gapDays,
  },
  {
    id: 'R8',
    dimension: 'DSO',
    priority: 7,
    condition: (result) => result.dso.trendDelta > 5,
    titleTemplate: (result) => `Investigate why collections slowed by ${formatDays(result.dso.trendDelta)}`,
    estimatedDaysTemplate: (result) => result.dso.trendDelta,
  },
];

export function evaluateLayer1(
  result: CCCResult,
  context: CompanyContext = createDefaultCompanyContext()
): RecommendationCandidate[] {
  return LAYER1_RULES
    .filter((rule) => rule.condition(result, context))
    .map((rule) => ({
      id: rule.id,
      dimension: rule.dimension,
      priority: rule.priority,
      title: rule.titleTemplate(result),
      estimatedDays: Math.max(0, rule.estimatedDaysTemplate(result)),
    }))
    .sort((a, b) => b.estimatedDays - a.estimatedDays || b.priority - a.priority)
    .slice(0, 8);
}

export function buildFallbackRecommendations(
  candidates: RecommendationCandidate[],
  result: CCCResult,
  context: CompanyContext = createDefaultCompanyContext()
): Recommendation[] {
  const rankedCandidates = candidates.length > 0 ? candidates : createMaintenanceCandidates(result);

  return rankedCandidates
    .slice()
    .sort((a, b) => b.estimatedDays - a.estimatedDays || b.priority - a.priority)
    .slice(0, 5)
    .map((candidate) => ({
      id: candidate.id,
      dimension: candidate.dimension,
      priority: priorityLabel(candidate.priority),
      title: candidate.title,
      explanation: getFallbackExplanation(candidate.dimension, result, context),
      actionSteps: getFallbackActionSteps(candidate.dimension),
      estimatedDaysReduction: Math.round(candidate.estimatedDays * 10) / 10,
      estimatedCashFreedLakhs: estimateCashFreedLakhs(result, candidate.estimatedDays),
    }));
}

export function createDefaultCompanyContext(): CompanyContext {
  return {
    fabricTypes: [],
    buyerTypes: [],
    month: new Date().getMonth() + 1,
    revenueRange: 'unknown',
    dataSource: 'Excel/Tally export',
  };
}

function createMaintenanceCandidates(result: CCCResult): RecommendationCandidate[] {
  return [
    {
      id: 'M1',
      dimension: 'DSO',
      priority: 4,
      title: 'Keep a weekly receivables follow-up rhythm',
      estimatedDays: Math.max(0, result.dso.value - result.dso.benchmark),
    },
    {
      id: 'M2',
      dimension: 'DIO',
      priority: 4,
      title: 'Review slow-moving stock before placing fresh orders',
      estimatedDays: Math.max(0, result.dio.value - result.dio.benchmark),
    },
    {
      id: 'M3',
      dimension: 'DPO',
      priority: 3,
      title: 'Pay suppliers on due dates, not much earlier',
      estimatedDays: Math.max(0, result.dpo.benchmark - result.dpo.value),
    },
  ];
}

function priorityLabel(priority: number): Recommendation['priority'] {
  if (priority > 7) return 'HIGH';
  if (priority > 4) return 'MEDIUM';
  return 'LOW';
}

function getFallbackExplanation(
  dimension: MetricDimension,
  result: CCCResult,
  context: CompanyContext
): string {
  const fabricText = context.fabricTypes.length > 0 ? ` for ${context.fabricTypes.join(', ')}` : '';
  const explanations: Record<MetricDimension, string> = {
    DIO: `Inventory is held for ${result.dio.value.toFixed(1)} days against a textile benchmark of ${result.dio.benchmark} days${fabricText}. Reducing slow-moving stock lowers the cash tied up on the shop floor.`,
    DSO: `Customers are paying in ${result.dso.value.toFixed(1)} days against a benchmark of ${result.dso.benchmark} days. Faster collections put cash back into the business without increasing sales.`,
    DPO: `Suppliers are being paid in ${result.dpo.value.toFixed(1)} days against a benchmark of ${result.dpo.benchmark} days. Moving payments closer to agreed due dates keeps cash available for operations.`,
    CCC: `Your cash conversion cycle is ${result.ccc.toFixed(1)} days against a benchmark of ${result.benchmarkCCC} days. The fastest gains usually come from the largest DIO, DSO, or DPO gap.`,
  };

  return explanations[dimension];
}

function getFallbackActionSteps(dimension: MetricDimension): string[] {
  const steps: Record<MetricDimension, string[]> = {
    DIO: [
      'List stock items with low movement in the last 30 days.',
      'Separate fast-moving items from old or seasonal stock.',
      'Pause repeat purchases for items already above target stock.',
    ],
    DSO: [
      'Create an aging list for invoices overdue by more than 30 days.',
      'Call the top five overdue buyers this week.',
      'Add payment due dates and reminders to every new invoice.',
    ],
    DPO: [
      'Compare actual payment dates with supplier due dates.',
      'Move early payments to their due dates unless there is a clear discount.',
      'Ask key suppliers for 7 to 14 extra credit days on repeat orders.',
    ],
    CCC: [
      'Start with the metric showing the biggest benchmark gap.',
      'Assign one owner for receivables, inventory, and supplier payments.',
      'Re-run this analysis after the next accounting export.',
    ],
  };

  return steps[dimension];
}

function estimateCashFreedLakhs(result: CCCResult, days: number): number {
  if (days <= 0 || result.summary.totalSales <= 0 || result.periodDays <= 0) return 0;

  const dailySales = result.summary.totalSales / result.periodDays;
  return Math.round((dailySales * days) / 1000) / 100;
}

function formatDays(days: number): string {
  return `${Math.max(0, days).toFixed(1)} days`;
}
