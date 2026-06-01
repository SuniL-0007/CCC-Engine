import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enrichRecommendationsWithGemini,
  type Recommendation,
} from '@/lib/recommendations/geminiClient';
import type { Layer1Candidate } from '@/lib/ccc-engine/types';

const MetricSchema = z.object({
  value: z.number(),
  benchmark: z.number(),
  gapDays: z.number(),
  trendDelta: z.number(),
  dataCompleteness: z.number(),
});

const RecommendationRequestSchema = z.object({
  cccResult: z.object({
    dio: MetricSchema,
    dso: MetricSchema,
    dpo: MetricSchema,
    ccc: z.number(),
    benchmarkCCC: z.number(),
    gapDays: z.number(),
    periodDays: z.number(),
    calculatedAt: z.coerce.date(),
  }),
  companyContext: z.object({
    fabricTypes: z.array(z.string()),
    buyerTypes: z.array(z.string()),
    month: z.number(),
    revenueRange: z.string(),
    companyName: z.string().optional(),
    city: z.string().optional(),
    dataSource: z.string().optional(),
  }),
  layer1Candidates: z.array(
    z.object({
      id: z.string(),
      dimension: z.enum(['DIO', 'DSO', 'DPO']),
      priority: z.number(),
      title: z.string(),
      estimatedDaysReduction: z.number(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const validated = RecommendationRequestSchema.parse(await request.json());

    try {
      const recommendations = await enrichRecommendationsWithGemini(validated);
      return NextResponse.json({ recommendations: recommendations.slice(0, 5), source: 'gemini' });
    } catch (error) {
      console.info('Recommendation API using deterministic fallback:', error);
      const recommendations = buildFallbackRecommendations(validated.layer1Candidates);

      return NextResponse.json({ recommendations, source: 'fallback' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Recommendation API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

function buildFallbackRecommendations(candidates: Layer1Candidate[]): Recommendation[] {
  return candidates.slice(0, 5).map((candidate) => ({
    id: candidate.id,
    dimension: candidate.dimension,
    priority: candidate.priority >= 8 ? 'HIGH' : candidate.priority >= 5 ? 'MEDIUM' : 'LOW',
    title: candidate.title,
    explanation: `${candidate.title} targets the ${candidate.dimension} gap identified by the Layer 1 rule engine.`,
    actionSteps: getActionSteps(candidate.dimension),
    estimatedDaysReduction: candidate.estimatedDaysReduction,
    estimatedCashFreedLakhs: 0,
  }));
}

function getActionSteps(dimension: Layer1Candidate['dimension']): string[] {
  const steps: Record<Layer1Candidate['dimension'], string[]> = {
    DIO: [
      'List the oldest or slowest-moving inventory items.',
      'Pause repeat purchases for overstocked fabric categories.',
      'Set reorder quantities from recent sales velocity.',
    ],
    DSO: [
      'Create an aging list for unpaid buyer invoices.',
      'Follow up on the largest overdue balances first.',
      'Add due-date reminders for all new invoices.',
    ],
    DPO: [
      'Review suppliers paid before due date.',
      'Move early payments closer to agreed terms.',
      'Ask key suppliers for longer repeat-order credit terms.',
    ],
  };

  return steps[dimension];
}
