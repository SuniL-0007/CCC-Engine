import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const SnapshotSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  companyName: z.string().min(1),
  city: z.string().min(1),
  fabricTypes: z.array(z.string()),
  result: z.object({
    dio: z.object({ value: z.number(), benchmark: z.number(), trendDelta: z.number() }),
    dso: z.object({ value: z.number(), benchmark: z.number(), trendDelta: z.number() }),
    dpo: z.object({ value: z.number(), benchmark: z.number(), trendDelta: z.number() }),
    ccc: z.number(),
    benchmarkCCC: z.number(),
    gapDays: z.number(),
    periodDays: z.number(),
    estimatedCashLockedLakhs: z.number(),
    generatedAt: z.string(),
    warnings: z.array(z.string()),
    summary: z.object({
      totalSales: z.number(),
      totalPurchases: z.number(),
      totalInventory: z.number(),
      outstandingAR: z.number(),
      outstandingAP: z.number(),
      cogs: z.number(),
    }),
    recommendations: z.array(z.unknown()).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const snapshot = SnapshotSchema.parse(await request.json());

    return NextResponse.json(
      {
        success: true,
        snapshotId: `snapshot-${Date.now()}`,
        companyName: snapshot.companyName,
        message: 'Results saved successfully.',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid snapshot payload', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Save snapshot error:', error);
    return NextResponse.json({ error: 'Failed to save results' }, { status: 500 });
  }
}
