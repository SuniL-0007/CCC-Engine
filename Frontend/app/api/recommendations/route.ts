import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for validation
const RecommendationRequestSchema = z.object({
  cccResult: z.object({
    dio: z.object({
      value: z.number(),
      trendDelta: z.number(),
      benchmark: z.number(),
    }),
    dso: z.object({
      value: z.number(),
      trendDelta: z.number(),
      benchmark: z.number(),
    }),
    dpo: z.object({
      value: z.number(),
      trendDelta: z.number(),
      benchmark: z.number(),
    }),
    ccc: z.number(),
    benchmarkCCC: z.number(),
    gapDays: z.number(),
  }),
  companyContext: z.object({
    fabricTypes: z.array(z.string()),
    buyerTypes: z.array(z.string()),
    month: z.number(),
    revenueRange: z.string(),
  }),
  layer1Candidates: z.array(
    z.object({
      id: z.string(),
      dimension: z.enum(['DIO', 'DSO', 'DPO']),
      priority: z.number(),
      title: z.string(),
      estimatedDays: z.number(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validated = RecommendationRequestSchema.parse(body);

    // For now, return Layer 1 candidates with enriched templates
    // TODO: Call Anthropic API when ANTHROPIC_API_KEY is configured
    const recommendations = validated.layer1Candidates.slice(0, 5).map((candidate) => ({
      id: candidate.id,
      dimension: candidate.dimension,
      priority:
        candidate.priority > 7 ? 'HIGH' : candidate.priority > 4 ? 'MEDIUM' : 'LOW',
      title: candidate.title,
      explanation: getExplanationForCandidate(
        candidate.dimension,
        validated.cccResult,
        validated.companyContext
      ),
      actionSteps: getActionStepsForDimension(candidate.dimension),
      estimatedDaysReduction: candidate.estimatedDays,
      estimatedCashFreedLakhs: estimateCashFreed(
        candidate.dimension,
        candidate.estimatedDays,
        validated.companyContext.revenueRange
      ),
    }));

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('Recommendation API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

function getExplanationForCandidate(
  dimension: string,
  cccResult: any,
  _context: any
): string {
  const explanations: Record<string, string> = {
    DIO: `Your inventory is tied up for ${cccResult.dio.value.toFixed(1)} days against a benchmark of ${cccResult.dio.benchmark} days. Improving turnover directly reduces working capital needs.`,
    DSO: `You're collecting payments in ${cccResult.dso.value.toFixed(1)} days against a benchmark of ${cccResult.dso.benchmark} days. Faster collection accelerates cash inflow.`,
    DPO: `You're paying suppliers in ${cccResult.dpo.value.toFixed(1)} days against a benchmark of ${cccResult.dpo.benchmark} days. Optimizing payment terms improves cash retention.`,
  };

  return explanations[dimension] || 'Optimize this metric to improve your CCC.';
}

function getActionStepsForDimension(dimension: string): string[] {
  const steps: Record<string, string[]> = {
    DIO: [
      'Conduct inventory audit and identify slow-moving stock',
      'Implement ABC classification (A: fast-moving, C: slow)',
      'Negotiate faster delivery schedules with suppliers',
      'Reduce batch sizes and increase order frequency',
    ],
    DSO: [
      'Create an aging analysis of outstanding receivables',
      'Follow up on invoices overdue by 30+ days',
      'Offer early payment discounts (1-2% for 10-day payment)',
      'Implement automated payment reminders',
    ],
    DPO: [
      'Review supplier terms and negotiate extensions',
      'Establish a payment calendar aligned to cash inflows',
      'Explore supply chain financing options',
      'Build stronger relationships with key vendors',
    ],
  };

  return steps[dimension] || ['Review and optimize this metric'];
}

function estimateCashFreed(_dimension: string, days: number, revenueRange: string): number {
  // Simplified calculation - scale based on revenue range
  const dailyRevenueMap: Record<string, number> = {
    '1cr_10cr': 0.03,
    '10cr_50cr': 0.15,
    '50cr_100cr': 0.35,
    '100cr_plus': 1.0,
    unknown: 0.1,
  };

  const dailyRevenue = dailyRevenueMap[revenueRange] || 0.1;
  return days * dailyRevenue;
}
