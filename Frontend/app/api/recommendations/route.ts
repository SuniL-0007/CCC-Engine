import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enrichRecommendationsWithGemini } from '@/lib/recommendations/geminiClient';
import type { Recommendation, Layer1Candidate } from '@/lib/ccc-engine/types';

const ComponentResultSchema = z.object({
  value: z.number(),
  benchmark: z.number(),
  gapDays: z.number(),
  trendDelta: z.number(),
  dataCompleteness: z.number(),
});

const CCCResultSchema = z.object({
  dio: ComponentResultSchema,
  dso: ComponentResultSchema,
  dpo: ComponentResultSchema,
  ccc: z.number(),
  benchmarkCCC: z.number(),
  gapDays: z.number(),
  periodDays: z.number(),
  calculatedAt: z.string().transform(str => new Date(str)),
});

const Layer1CandidateSchema = z.object({
  id: z.string(),
  dimension: z.enum(['DIO', 'DSO', 'DPO']),
  priority: z.number(),
  title: z.string(),
  estimatedDaysReduction: z.number(),
});

const CompanyContextSchema = z.object({
  fabricTypes: z.array(z.string()).optional().default([]),
  month: z.number().min(1).max(12).optional().default(new Date().getMonth() + 1),
  revenueRange: z
    .enum(['under_5cr', '5cr_to_50cr', 'above_50cr'])
    .optional()
    .default('5cr_to_50cr'),
});

const RequestBodySchema = z.object({
  cccResult: CCCResultSchema,
  companyContext: CompanyContextSchema.optional().default({}),
  layer1Candidates: z.array(Layer1CandidateSchema),
});

function parseRequestBody(request: NextRequest): Promise<unknown> {
  return request.json();
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await parseRequestBody(request);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { layer1Candidates } = parsed.data;
  if (layer1Candidates.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  try {
    const recommendations = await enrichRecommendationsWithGemini(parsed.data);
    return NextResponse.json({ recommendations: recommendations.slice(0, 5), source: 'gemini' });
  } catch (error) {
    console.error('[recommendations] Gemini fallback:', error);
    return NextResponse.json({
      recommendations: buildFallbackRecommendations(layer1Candidates),
      source: 'fallback',
    });
  }
}

function buildFallbackRecommendations(candidates: Layer1Candidate[]): Recommendation[] {
  const priorityLabel = (priority: number): Recommendation['priority'] =>
    priority >= 8 ? 'HIGH' : priority >= 5 ? 'MEDIUM' : 'LOW';

  return candidates.slice(0, 5).map((candidate) => ({
    id: candidate.id,
    dimension: candidate.dimension,
    priority: priorityLabel(candidate.priority),
    title: candidate.title,
    explanation:
      `Your ${candidate.dimension} metric is outside the textile benchmark. ` +
      `Addressing this could reduce your CCC by approximately ${candidate.estimatedDaysReduction} days.`,
    actionSteps: [
      `Review your ${candidate.dimension} data for the past 30 days`,
      `Identify the top 3 counterparties contributing to this gap`,
      `Schedule a follow-up with your finance team this week`,
    ],
    estimatedDaysReduction: candidate.estimatedDaysReduction,
    estimatedCashFreedLakhs: Math.round(candidate.estimatedDaysReduction * 0.8 * 10) / 10,
  }));
}
