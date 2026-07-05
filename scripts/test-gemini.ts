import { enrichRecommendationsWithGemini } from '../lib/recommendations/geminiClient';
import { config } from 'dotenv';
import path from 'path';

// Load .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

async function test() {
  const payload = {
    cccResult: {
      dio: { value: 60, benchmark: 40, gapDays: 20, trendDelta: 5, dataCompleteness: 100 },
      dso: { value: 70, benchmark: 45, gapDays: 25, trendDelta: 2, dataCompleteness: 100 },
      dpo: { value: 30, benchmark: 45, gapDays: -15, trendDelta: -5, dataCompleteness: 100 },
      ccc: 100,
      benchmarkCCC: 40,
      gapDays: 60,
      periodDays: 365,
      calculatedAt: new Date(),
    },
    companyContext: {
      fabricTypes: ['Cotton'],
      month: 6,
      revenueRange: '5cr_to_50cr',
      city: 'Surat'
    },
    layer1Candidates: [
      {
        id: 'L1_1',
        dimension: 'DSO' as const,
        priority: 'HIGH' as const,
        title: 'Reduce DSO',
        explanation: 'Your DSO is high.',
        actionSteps: ['Call clients', 'Send emails', 'Stop delivery'],
        estimatedDaysReduction: 10,
        estimatedCashFreedLakhs: 5
      }
    ]
  };

  try {
    console.log("Calling Gemini...");
    const result = await enrichRecommendationsWithGemini(payload);
    console.log("SUCCESS. Result from Gemini:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("FAILED.");
    console.error(err.message);
  }
}

test();
