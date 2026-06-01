import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';
import { AuthError, requireSupabaseUser } from '@/lib/auth/supabaseServer';

const SnapshotSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  companyName: z.string().min(1),
  city: z.string().min(1),
  fabricTypes: z.array(z.string()),
  result: z.object({
    dio: z.object({
      value: z.number(),
      benchmark: z.number(),
      gapDays: z.number(),
      trendDelta: z.number(),
      dataCompleteness: z.number(),
    }),
    dso: z.object({
      value: z.number(),
      benchmark: z.number(),
      gapDays: z.number(),
      trendDelta: z.number(),
      dataCompleteness: z.number(),
    }),
    dpo: z.object({
      value: z.number(),
      benchmark: z.number(),
      gapDays: z.number(),
      trendDelta: z.number(),
      dataCompleteness: z.number(),
    }),
    ccc: z.number(),
    benchmarkCCC: z.number(),
    gapDays: z.number(),
    periodDays: z.number(),
    calculatedAt: z.string(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const snapshot = SnapshotSchema.parse(await request.json());
    await requireSupabaseUser(request, snapshot.userId);
    const prisma = getPrismaClient();
    const company = await prisma.company.upsert({
      where: { userId: snapshot.userId },
      update: {
        name: snapshot.companyName,
        city: snapshot.city,
        fabricTypes: snapshot.fabricTypes,
      },
      create: {
        userId: snapshot.userId,
        name: snapshot.companyName,
        city: snapshot.city,
        fabricTypes: snapshot.fabricTypes,
      },
    });

    const savedSnapshot = await prisma.cCCSnapshot.create({
      data: {
        companyId: company.id,
        dio: snapshot.result.dio.value,
        dso: snapshot.result.dso.value,
        dpo: snapshot.result.dpo.value,
        ccc: snapshot.result.ccc,
        benchmarkDio: snapshot.result.dio.benchmark,
        benchmarkDso: snapshot.result.dso.benchmark,
        benchmarkDpo: snapshot.result.dpo.benchmark,
        benchmarkCcc: snapshot.result.benchmarkCCC,
        recommendations: [] as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(
      {
        success: true,
        snapshotId: savedSnapshot.id,
        companyId: company.id,
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

    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Save snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to save results. Check DATABASE_URL and Prisma migration status.' },
      { status: 500 }
    );
  }
}
