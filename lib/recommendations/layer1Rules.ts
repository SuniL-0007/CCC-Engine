import { estimateCashFreedLakhs } from '@/lib/ccc-engine/cash';
import type { CCCResult, Layer1Candidate } from '@/lib/ccc-engine/types';

interface RecommendationRule {
  id: string;
  dimension: 'DIO' | 'DSO' | 'DPO';
  basePriority: number;
  condition: (result: CCCResult) => boolean;
  title: (result: CCCResult) => string;
  explanation: (result: CCCResult) => string;
  actionSteps: (result: CCCResult) => string[];
  estimatedDays: (result: CCCResult) => number;
  priorityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

const RULES: RecommendationRule[] = [
  {
    id: 'R1',
    dimension: 'DSO',
    basePriority: 9,
    priorityLevel: 'HIGH',
    condition: (result) => result.dso.value > result.dso.benchmark + 10,
    title: () => 'Chase overdue AR invoices immediately',
    explanation: () => 'Your DSO is significantly above industry benchmark, indicating unpaid invoices are sitting too long. Recovering even 10% of overdue AR directly improves cash flow without operational changes.',
    actionSteps: () => [
      'Run AR aging report, identify invoices over 60 days, contact customers with payment agreements',
      'Implement weekly follow-up calls for overdue accounts above Rs 10 lakhs',
      'Offer 2% early payment discount for invoices paid within 15 days',
    ],
    estimatedDays: (result) => Math.round(result.dso.gapDays * 0.6),
  },
  {
    id: 'R2',
    dimension: 'DSO',
    basePriority: 8,
    priorityLevel: 'HIGH',
    condition: (result) => result.dso.value > result.dso.benchmark + 5,
    title: () => 'Introduce payment reminders for buyers',
    explanation: () => 'Buyers are paying 5-10 days slower than textile industry average. Automated reminders 5 days before due date reduce collection time without damaging customer relationships.',
    actionSteps: () => [
      'Set up invoice email template with payment deadline prominently featured, send at point of invoice',
      'Create automated 5-day-before-due reminder in your accounting software (Tally/QuickBooks)',
      'Add payment incentive clause: "Net 45" as baseline, 2% discount if paid within Net 30',
    ],
    estimatedDays: (result) => Math.round(result.dso.gapDays * 0.4),
  },
  {
    id: 'R3',
    dimension: 'DIO',
    basePriority: 8,
    priorityLevel: 'HIGH',
    condition: (result) => result.dio.value > result.dio.benchmark + 15,
    title: () => 'Reduce slow-moving fabric inventory',
    explanation: () => 'Inventory is turning 15+ days slower than benchmarks, suggesting dead stock occupying working capital. Clearing slow movers immediately releases cash without demand impact.',
    actionSteps: () => [
      'Pull inventory turnover by SKU, identify items with zero sales in last 90 days',
      'Discount slow movers by 15-25% to move within 2 weeks, reallocate shelf space to fast-movers',
      'Review purchase orders with suppliers—cancel or defer orders for slow items, reallocate to in-demand fabrics',
    ],
    estimatedDays: (result) => Math.round(result.dio.gapDays * 0.5),
  },
  {
    id: 'R4',
    dimension: 'DIO',
    basePriority: 6,
    priorityLevel: 'MEDIUM',
    condition: (result) => result.dio.value > result.dio.benchmark + 5,
    title: () => 'Tighten fabric reorder points',
    explanation: () => 'Reorder points may be set too high, causing excess inventory. Right-sizing reorder quantities reduces average inventory levels by 10-20% without stockout risk.',
    actionSteps: () => [
      'Calculate reorder points using formula: (Lead time × Daily sales) + Safety stock. Reduce safety stock from 30 days to 15 days for top 10 SKUs',
      'Run 6-month sales forecast, align purchase orders to 6-week lead time instead of current 12-week pattern',
      'Brief sales team: prioritize slow inventory items in quotes to rotate stock faster',
    ],
    estimatedDays: (result) => Math.round(result.dio.gapDays * 0.3),
  },
  {
    id: 'R5',
    dimension: 'DPO',
    basePriority: 7,
    priorityLevel: 'HIGH',
    condition: (result) => result.dpo.value < result.dpo.benchmark - 10,
    title: () => 'Negotiate extended vendor payment terms',
    explanation: () => 'You are paying suppliers 10+ days faster than textile industry standard. Extending DPO to Net 45 (from current Net 35) directly reduces CCC without operational cost.',
    actionSteps: () => [
      'List top 10 suppliers by spend, send letter: "Propose payment terms extension from Net 35 to Net 45 to align with industry standard"',
      'Highlight: consistent payment history, volume growth potential, multi-year partnership. Offer to lock in volume commitments in exchange',
      'Start with 3 largest suppliers, successful negotiations set precedent for others',
    ],
    estimatedDays: (result) => Math.round(Math.abs(result.dpo.gapDays) * 0.5),
  },
  {
    id: 'R6',
    dimension: 'DPO',
    basePriority: 5,
    priorityLevel: 'MEDIUM',
    condition: (result) => result.dpo.value < result.dpo.benchmark - 5,
    title: () => 'Request Net 45 from top 3 suppliers',
    explanation: () => 'Your top suppliers represent 40-60% of spend. Extending terms from Net 30 to Net 45 with just 3 suppliers improves cash position by 2-3 weeks on 50% of payables.',
    actionSteps: () => [
      'Identify top 3 suppliers by annual spend, request meeting with vendor account manager',
      'Propose: "We want to increase order volumes by 15% annually. Can we extend terms to Net 45?"',
      'If declined, offer in exchange: automated payment via NEFT, quarterly orders instead of monthly, or minimum order value commitment',
    ],
    estimatedDays: (result) => Math.round(Math.abs(result.dpo.gapDays) * 0.3),
  },
  {
    id: 'R7',
    dimension: 'DSO',
    basePriority: 4,
    priorityLevel: 'MEDIUM',
    condition: (result) => result.dso.gapDays > 0 && result.dio.gapDays > 0,
    title: () => 'Introduce advance payment policy for new buyers',
    explanation: () => 'Both DSO and DIO are above benchmark. New buyers with unproven payment history should be Net 15 (advance 50%) to protect cash flow during growth.',
    actionSteps: () => [
      'Define "new buyer" as < 6-month history. Require 50% prepayment for first 3 orders, standard Net 45 terms from order 4 onward',
      'Communicate policy at order confirmation: "First-time orders require 50% advance payment to expedite production. Standard Net 45 from repeat orders."',
      'Monitor: if new buyer pays on time for 3 orders, graduate to standard terms automatically',
    ],
    estimatedDays: () => 5,
  },
  {
    id: 'R8',
    dimension: 'DIO',
    basePriority: 3,
    priorityLevel: 'LOW',
    condition: (result) => result.dio.value > result.dio.benchmark,
    title: () => 'Review procurement forecast accuracy',
    explanation: () => 'Inventory is higher than benchmark. Even a 5% improvement in forecast accuracy reduces safety stock needs by 2-3 days without risk of stockouts.',
    actionSteps: () => [
      'Analyze last 12 months: compare forecasted vs actual sales by month. Calculate forecast error % (MAPE)',
      'If MAPE > 25%, tighten forecast review cycle from quarterly to monthly with sales team',
      'Implement: sales team updates monthly forecast by 10th of each month, procurement orders on 15th for 6-week delivery',
    ],
    estimatedDays: () => 3,
  },
];

export function evaluateLayer1(cccResult: CCCResult): Layer1Candidate[] {
  return RULES
    .filter((rule) => rule.condition(cccResult))
    .sort((a, b) => b.basePriority - a.basePriority)
    .slice(0, 5)
    .map((rule) => {
      const daysReduction = rule.estimatedDays(cccResult);

      return {
        id: rule.id,
        dimension: rule.dimension,
        priority: rule.priorityLevel,
        title: rule.title(cccResult),
        explanation: rule.explanation(cccResult),
        actionSteps: rule.actionSteps(cccResult),
        estimatedDaysReduction: daysReduction,
        estimatedCashFreedLakhs: estimateCashFreedLakhs(daysReduction, cccResult),
      };
    });
}
