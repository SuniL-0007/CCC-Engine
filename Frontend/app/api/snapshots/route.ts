import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db/prisma';
import { CCCResult, Recommendation } from '@/lib/ccc-engine/types';
import { AuthError, requireSupabaseUser } from '@/lib/auth/supabaseServer';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    await requireSupabaseUser(request, userId);
    const prisma = getPrismaClient();
    const company = await prisma.company.findUnique({
      where: { userId },
      include: {
        cccSnapshots: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ snapshots: [] });
    }

    return NextResponse.json({
      snapshots: company.cccSnapshots.map((snapshot) => ({
        id: snapshot.id,
        createdAt: snapshot.createdAt.toISOString(),
        companyName: company.name,
        city: company.city,
        result: toCCCResult(snapshot),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('List snapshots error:', error);
    return NextResponse.json(
      { error: 'Failed to load snapshots. Check DATABASE_URL and Prisma migration status.' },
      { status: 500 }
    );
  }
}

function toCCCResult(snapshot: {
  dio: number;
  dso: number;
  dpo: number;
  ccc: number;
  benchmarkDio: number;
  benchmarkDso: number;
  benchmarkDpo: number;
  benchmarkCcc: number;
  recommendations: unknown;
  createdAt: Date;
}): CCCResult {
  return {
    dio: { value: snapshot.dio, benchmark: snapshot.benchmarkDio, trendDelta: 0 },
    dso: { value: snapshot.dso, benchmark: snapshot.benchmarkDso, trendDelta: 0 },
    dpo: { value: snapshot.dpo, benchmark: snapshot.benchmarkDpo, trendDelta: 0 },
    ccc: snapshot.ccc,
    benchmarkCCC: snapshot.benchmarkCcc,
    gapDays: Math.round((snapshot.ccc - snapshot.benchmarkCcc) * 100) / 100,
    periodDays: 0,
    estimatedCashLockedLakhs: 0,
    summary: {
      totalSales: 0,
      totalPurchases: 0,
      totalInventory: 0,
      outstandingAR: 0,
      outstandingAP: 0,
      cogs: 0,
    },
    generatedAt: snapshot.createdAt.toISOString(),
    warnings: [],
    recommendations: Array.isArray(snapshot.recommendations)
      ? (snapshot.recommendations as Recommendation[])
      : [],
  };
}
