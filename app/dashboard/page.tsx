'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { clearSnapshots, loadSnapshots, type StoredSnapshot } from '@/lib/history/snapshots'

export default function DashboardPage() {
  const [snapshots, setSnapshots] = useState<StoredSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSnapshots(loadSnapshots());
    setLoaded(true);
  }, []);

  const latest = snapshots[0] ?? null;
  const previous = snapshots[1] ?? null;

  return (
    <main className="min-h-screen bg-canvas p-4">
      <div className="mx-auto max-w-6xl py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-ink">Dashboard</h1>
            <p className="mt-2 text-body">
              CCC history from analyses run in this browser. Nothing is stored on any server.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {snapshots.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearSnapshots();
                  setSnapshots([]);
                }}
                className="text-xs text-faint hover:text-[#DC2626]"
              >
                Clear history
              </button>
            )}
            <Link
              href="/"
              className="rounded-[7px] bg-[#2563EB] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1D4ED8]"
            >
              Run new analysis
            </Link>
          </div>
        </div>

        {latest && (
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <TrendCard label="CCC" title="Cash Conversion Cycle" value={latest.ccc} previous={previous?.ccc} lowerIsBetter />
            <TrendCard label="DIO" title="Days Inventory Outstanding" value={latest.dio} previous={previous?.dio} lowerIsBetter />
            <TrendCard label="DSO" title="Days Sales Outstanding" value={latest.dso} previous={previous?.dso} lowerIsBetter />
            <TrendCard label="DPO" title="Days Payables Outstanding" value={latest.dpo} previous={previous?.dpo} lowerIsBetter={false} />
          </div>
        )}

        {loaded && snapshots.length === 0 ? (
          <div className="rounded-[10px] border border-edge bg-surface p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-ink">No analyses yet.</p>
            <p className="mt-2 text-body">
              Upload your files on the home page — every analysis is saved here automatically so you can track improvement over time.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-[7px] bg-[#2563EB] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1D4ED8]"
            >
              Run your first analysis →
            </Link>
          </div>
        ) : snapshots.length > 0 ? (
          <div className="overflow-hidden rounded-[10px] border border-edge bg-surface shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-edge bg-surface2 text-[11px] uppercase tracking-wider text-faint">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 font-semibold">DIO</th>
                  <th className="px-4 py-3 font-semibold">DSO</th>
                  <th className="px-4 py-3 font-semibold">DPO</th>
                  <th className="px-4 py-3 font-semibold">CCC</th>
                  <th className="px-4 py-3 font-semibold">vs benchmark</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="border-b border-edge/60 last:border-0">
                    <td className="px-4 py-3 text-body">
                      {new Date(snapshot.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-faint">{snapshot.periodDays}d</td>
                    <td className="px-4 py-3 font-medium text-ink">{snapshot.dio.toFixed(1)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{snapshot.dso.toFixed(1)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{snapshot.dpo.toFixed(1)}</td>
                    <td className="px-4 py-3 font-bold text-ink">{snapshot.ccc.toFixed(1)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          snapshot.gapDays > 0
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                            : 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                        }`}
                      >
                        {snapshot.gapDays > 0 ? `+${snapshot.gapDays.toFixed(0)}d` : `${snapshot.gapDays.toFixed(0)}d`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function TrendCard({
  label,
  title,
  value,
  previous,
  lowerIsBetter,
}: {
  label: string;
  title: string;
  value: number;
  previous?: number;
  lowerIsBetter: boolean;
}) {
  const delta = previous !== undefined ? Math.round((value - previous) * 10) / 10 : null;
  const deltaIsGood = delta !== null && (lowerIsBetter ? delta < 0 : delta > 0);

  return (
    <div className="rounded-[10px] border border-edge bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-faint">{label}</p>
        {delta !== null && delta !== 0 && (
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
              deltaIsGood ? 'bg-[#F0FDF4] text-[#15803D] dark:bg-green-950/40 dark:text-green-400' : 'bg-[#FEF2F2] text-[#DC2626] dark:bg-red-950/40 dark:text-red-400'
            }`}
          >
            {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}d
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold text-ink">
        {value.toFixed(1)}
        <span className="text-sm font-normal text-faint">d</span>
      </p>
      <p className="mt-1 text-xs text-faint">{title}</p>
    </div>
  );
}
