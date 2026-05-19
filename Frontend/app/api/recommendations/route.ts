import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enrichRecommendationsWithGemini } from '@/lib/recommendations/geminiClient';
import { buildFallbackRecommendations } from '@/lib/recommendations/layer1Rules';

const MetricSchema = z.object({
  value: z.number(),
  trendDelta: z.number(),
  benchmark: z.number(),
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
    estimatedCashLockedLakhs: z.number(),
    summary: z.object({
      totalSales: z.number(),
      totalPurchases: z.number(),
      totalInventory: z.number(),
      outstandingAR: z.number(),
      outstandingAP: z.number(),
      cogs: z.number(),
    }),
    generatedAt: z.string(),
    warnings: z.array(z.string()),
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
      dimension: z.enum(['DIO', 'DSO', 'DPO', 'CCC']),
      priority: z.number(),
      title: z.string(),
      estimatedDays: z.number(),
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
      const recommendations = buildFallbackRecommendations(
        validated.layer1Candidates,
        validated.cccResult,
        validated.companyContext
      );

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
