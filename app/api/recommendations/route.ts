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
  dailyRevenueLakhs: z.number().positive().optional(),
});

const Layer1CandidateSchema = z.object({
  id: z.string(),
  dimension: z.enum(['DIO', 'DSO', 'DPO']),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  title: z.string(),
  explanation: z.string(),
  actionSteps: z.array(z.string()).length(3),
  estimatedDaysReduction: z.number(),
  estimatedCashFreedLakhs: z.number(),
});

const CompanyContextSchema = z.object({
  fabricTypes: z.array(z.string()).optional().default([]),
  month: z.number().min(1).max(12).optional().default(new Date().getMonth() + 1),
  revenueRange: z
    .enum(['under_5cr', '5cr_to_50cr', 'above_50cr'])
    .optional()
    .default('5cr_to_50cr'),
  city: z.string().optional(),
  buyerTypes: z.array(z.string()).optional(),
});

const RequestBodySchema = z.object({
  cccResult: CCCResultSchema,
  companyContext: CompanyContextSchema.optional().default({}),
  layer1Candidates: z.array(Layer1CandidateSchema),
});

function parseRequestBody(request: NextRequest): Promise<unknown> {
  return request.json();
}

// Helper: Convert month number to season label
function getSeasonLabel(month: number): string {
  if ([10, 11, 12].includes(month)) return 'peak Diwali/wedding season — high inventory is normal'
  if ([1, 2, 3].includes(month))    return 'post-season — slow inventory is a red flag'
  if ([4, 5, 6].includes(month))    return 'summer — moderate demand period'
  return 'pre-festive buildup period'
}

// Helper: Estimate cash locked from the CCC gap. Prefers the real daily revenue
// derived from the uploaded Sales Register; falls back to the revenue-range assumption.
function estimateCashLocked(
  result: { gapDays: number; dailyRevenueLakhs?: number },
  revenueRange: string
): number {
  if (result.dailyRevenueLakhs && Number.isFinite(result.dailyRevenueLakhs)) {
    return Math.round(Math.max(result.gapDays, 0) * result.dailyRevenueLakhs);
  }

  const monthlyRevenue = {
    'under_5cr':    5_00_00_000 / 12,
    '5cr_to_50cr':  25_00_00_000 / 12,
    'above_50cr':   100_00_00_000 / 12,
  }[revenueRange] ?? 25_00_00_000 / 12

  const dailyRevenue = monthlyRevenue / 30
  const cashLocked = Math.max(result.gapDays, 0) * dailyRevenue
  return Math.round(cashLocked / 1_00_000) // convert to lakhs
}

// Helper: Validate recommendation quality
function isRecommendationQuality(rec: Recommendation): boolean {
  // Check explanation is not empty
  const hasExplanation = rec.explanation && rec.explanation.length > 10 ? true : false
  // Check action steps are present and specific (more than 3 words each)
  const hasActionSteps = rec.actionSteps && rec.actionSteps.length === 3 && rec.actionSteps.every(s => s && s.split(' ').length > 3) ? true : false
  // Check title isn't too long
  const titleOk = rec.title && rec.title.split(' ').length <= 12 ? true : false
  return hasExplanation && hasActionSteps && titleOk
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

  const { layer1Candidates, cccResult, companyContext } = parsed.data;
  if (layer1Candidates.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  // Build richer user message for Gemini
  const userMessage = `
COMPANY CONTEXT:
- Fabric types: ${companyContext.fabricTypes.join(', ') || 'not specified'}
- Current month: ${companyContext.month} (${getSeasonLabel(companyContext.month)})
- Revenue range: ${companyContext.revenueRange}
- City: ${companyContext.city || 'not specified'}

CCC METRICS:
- DIO: ${cccResult.dio.value} days (benchmark: ${cccResult.dio.benchmark} days, gap: ${cccResult.dio.gapDays > 0 ? '+' : ''}${cccResult.dio.gapDays} days)
- DSO: ${cccResult.dso.value} days (benchmark: ${cccResult.dso.benchmark} days, gap: ${cccResult.dso.gapDays > 0 ? '+' : ''}${cccResult.dso.gapDays} days)  
- DPO: ${cccResult.dpo.value} days (benchmark: ${cccResult.dpo.benchmark} days, gap: ${cccResult.dpo.gapDays > 0 ? '+' : ''}${cccResult.dpo.gapDays} days)
- CCC: ${cccResult.ccc} days (benchmark: ${cccResult.benchmarkCCC} days)
- Estimated cash locked: Rs ${estimateCashLocked(cccResult, companyContext.revenueRange)} lakhs

TREND:
- DIO trend: ${cccResult.dio.trendDelta > 0 ? 'worsening' : cccResult.dio.trendDelta < 0 ? 'improving' : 'stable'} (${cccResult.dio.trendDelta} days vs last period)
- DSO trend: ${cccResult.dso.trendDelta > 0 ? 'worsening' : cccResult.dso.trendDelta < 0 ? 'improving' : 'stable'} (${cccResult.dso.trendDelta} days vs last period)
- DPO trend: ${cccResult.dpo.trendDelta > 0 ? 'improving' : cccResult.dpo.trendDelta < 0 ? 'worsening' : 'stable'} (${cccResult.dpo.trendDelta} days vs last period)

LAYER 1 CANDIDATE RECOMMENDATIONS (re-rank and enrich these):
${JSON.stringify(layer1Candidates, null, 2)}

Generate the top 5 recommendations for this specific company.
`;

  try {
    const recommendations = await enrichRecommendationsWithGemini(parsed.data, userMessage);
    
    // Validate recommendation quality. Gemini can never return more items than
    // it was given, so scale the bar down when few rules fired.
    const qualityRecs = recommendations.filter(isRecommendationQuality)
    const minQuality = Math.min(3, layer1Candidates.length)
    if (qualityRecs.length < minQuality) {
      // Gemini returned vague answers — use fallback instead
      console.warn('[recommendations] Low quality Gemini output, using fallback');
      return NextResponse.json({
        recommendations: buildFallbackRecommendations(layer1Candidates),
        source: 'fallback',
      });
    }
    
    return NextResponse.json({ recommendations: qualityRecs.slice(0, 5), source: 'gemini' });
  } catch (error) {
    console.error('[recommendations] Gemini fallback:', error);
    return NextResponse.json({
      recommendations: buildFallbackRecommendations(layer1Candidates),
      source: 'fallback',
    });
  }
}

function buildFallbackRecommendations(candidates: Layer1Candidate[]): Recommendation[] {
  return candidates.slice(0, 5).map((candidate) => ({
    id: candidate.id,
    dimension: candidate.dimension,
    priority: candidate.priority,
    title: candidate.title,
    explanation: candidate.explanation,
    actionSteps: candidate.actionSteps,
    estimatedDaysReduction: candidate.estimatedDaysReduction,
    estimatedCashFreedLakhs: candidate.estimatedCashFreedLakhs,
  }));
}
