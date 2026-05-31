'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CCCResult } from '@/lib/ccc-engine/types';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/auth/supabase';

interface LocalSnapshot {
  id: string;
  createdAt: string;
  companyName: string;
  city: string;
  result: CCCResult;
}

export default function DashboardPage() {
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSnapshots = async () => {
      const saved = JSON.parse(localStorage.getItem('fabriccash:snapshots') ?? '[]') as LocalSnapshot[];
      setSnapshots(saved);

      if (!isSupabaseConfigured()) return;

      const supabase = getSupabaseBrowserClient();
      const sessionResult = await supabase?.auth.getSession();
      const userId = sessionResult?.data.session?.user.id;
      const accessToken = sessionResult?.data.session?.access_token;

      if (!userId || !accessToken) return;

      const response = await fetch(`/api/snapshots?userId=${encodeURIComponent(userId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not load saved snapshots.');
      }

      const body = (await response.json()) as { snapshots: LocalSnapshot[] };
      setSnapshots(body.snapshots);
    };

    loadSnapshots().catch((err) => {
      setError(err instanceof Error ? err.message : 'Could not load saved snapshots.');
    });
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-950">Dashboard</h1>
            <p className="mt-2 text-slate-600">Saved CCC snapshots from this browser.</p>
          </div>
          <Link href="/" className="btn-primary min-h-11">
            Run New Analysis
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {snapshots.length > 0 && (
          <SummaryCards result={snapshots[0].result} />
        )}

        {snapshots.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">No saved snapshots yet.</p>
            <p className="mt-2 text-slate-600">Run an analysis and click Save Results to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {snapshots.map((snapshot) => (
              <article key={snapshot.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">{snapshot.companyName}</h2>
                    <p className="text-sm text-slate-600">
                      {snapshot.city} - {new Date(snapshot.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      snapshot.result.gapDays > 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    CCC {snapshot.result.ccc.toFixed(1)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Metric label="DIO" value={snapshot.result.dio.value} />
                  <Metric label="DSO" value={snapshot.result.dso.value} />
                  <Metric label="DPO" value={snapshot.result.dpo.value} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-950">{value.toFixed(1)}</p>
    </div>
  );
}
