import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/db/prisma';
import type { CCCResult, ComponentResult } from '@/lib/ccc-engine/types';
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
  createdAt: Date;
}): CCCResult {
  return {
    dio: toComponentResult(snapshot.dio, snapshot.benchmarkDio),
    dso: toComponentResult(snapshot.dso, snapshot.benchmarkDso),
    dpo: toComponentResult(snapshot.dpo, snapshot.benchmarkDpo),
    ccc: snapshot.ccc,
    benchmarkCCC: snapshot.benchmarkCcc,
    gapDays: snapshot.ccc - snapshot.benchmarkCcc,
    periodDays: 0,
    calculatedAt: snapshot.createdAt,
  };
}

function toComponentResult(value: number, benchmark: number): ComponentResult {
  return {
    value,
    benchmark,
    gapDays: value - benchmark,
    trendDelta: 0,
    dataCompleteness: 1,
  };
}
