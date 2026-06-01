'use client';

import { useState } from 'react';
import type { CCCResult, Layer1Candidate } from '@/lib/ccc-engine/types';
import { generateCCCReport } from '@/lib/report/pdfGenerator';
import { evaluateLayer1 } from '@/lib/recommendations/layer1Rules';
import { SignUpModal } from '@/components/landing/SignUpModal';

type MetricDimension = 'DIO' | 'DSO' | 'DPO' | 'CCC';

export function ResultPanel({ result }: { result: CCCResult }) {
  const [showSignUp, setShowSignUp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const recommendations = evaluateLayer1(result);

  return (
    <div className="space-y-8">
      {toast && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="DIO"
          value={result.dio.value}
          benchmark={result.dio.benchmark}
          direction="lower"
          definition="Days Inventory Outstanding: how long inventory usually sits before becoming sales."
        />
        <MetricCard
          label="DSO"
          value={result.dso.value}
          benchmark={result.dso.benchmark}
          direction="lower"
          definition="Days Sales Outstanding: how long customers usually take to pay invoices."
        />
        <MetricCard
          label="DPO"
          value={result.dpo.value}
          benchmark={result.dpo.benchmark}
          direction="higher"
          definition="Days Payable Outstanding: how long the business takes to pay suppliers."
        />
        <MetricCard
          label="CCC"
          value={result.ccc}
          benchmark={result.benchmarkCCC}
          direction="lower"
          definition="Cash Conversion Cycle: DIO plus DSO minus DPO."
        />
      </div>

      <div
        className={`rounded-lg border-l-4 p-6 ${
          result.gapDays > 0 ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'
        }`}
      >
        <p className="text-lg font-bold text-slate-950">
          {result.gapDays > 0 ? 'CCC is above the textile benchmark' : 'CCC is within the textile benchmark'}
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Your CCC is {result.ccc.toFixed(1)} days. Industry benchmark: {result.benchmarkCCC} days.
          Your gap: {formatSigned(result.gapDays)} days.
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Analysis period inferred from uploaded invoices: {result.periodDays} days.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-950">Top Recommendations</h3>
          <p className="mt-1 text-sm text-slate-600">
            Ranked by estimated cash-cycle impact. Never more than five actions.
          </p>
        </div>
        {recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.slice(0, 5).map((recommendation, index) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                rank={index + 1}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Preparing recommendations...
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <button
          type="button"
          onClick={() => generateCCCReport(result)}
          className="btn-primary min-h-11 flex-1"
        >
          Download my CCC Report (PDF)
        </button>
        <button
          type="button"
          onClick={() => setShowSignUp(true)}
          className="btn-secondary min-h-11 flex-1"
        >
          Save Results
        </button>
      </div>

      {showSignUp && (
        <SignUpModal
          result={result}
          onClose={() => setShowSignUp(false)}
          onSaved={(message) => {
            setToast(message);
            window.setTimeout(() => setToast(null), 5000);
          }}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  benchmark,
  direction,
  definition,
}: {
  label: MetricDimension;
  value: number;
  benchmark: number;
  direction: 'lower' | 'higher';
  definition: string;
}) {
  const isGood = direction === 'lower' ? value <= benchmark : value >= benchmark;

  return (
    <div className="group relative rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <span
          className={`rounded-full px-2 py-1 text-[11px] font-bold ${
            isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {isGood ? 'Good' : 'Gap'}
        </span>
      </div>
      <p className={`mt-3 text-3xl font-bold ${isGood ? 'text-green-700' : 'text-red-700'}`}>
        {value.toFixed(1)}
      </p>
      <p className="mt-1 text-xs text-slate-500">Benchmark: {benchmark} days</p>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-56 -translate-x-1/2 rounded-lg bg-slate-950 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
        {definition}
      </div>
    </div>
  );
}

function RecommendationCard({
  recommendation,
  rank,
}: {
  recommendation: Layer1Candidate;
  rank: number;
}) {
  const colorClass = getPriorityColor(recommendation.priority);

  return (
    <div className={`rounded-lg border-l-4 p-4 ${colorClass.panel}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-1 text-xs font-bold text-white ${colorClass.badge}`}>
          {rank}. {recommendation.priority}
        </span>
        <span className="rounded bg-white/70 px-2 py-1 text-xs font-semibold text-slate-700">
          {recommendation.dimension}
        </span>
      </div>
      <h4 className="text-base font-bold text-slate-950">{recommendation.title}</h4>
      <div className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-slate-700">
        <span className="font-semibold">Impact:</span>{' '}
        {recommendation.estimatedDaysReduction.toFixed(1)} days estimated CCC reduction
      </div>
    </div>
  );
}

function getPriorityColor(priority: number): {
  panel: string;
  badge: string;
} {
  if (priority >= 8) {
    return { panel: 'border-red-500 bg-red-50', badge: 'bg-red-600' };
  }

  if (priority >= 5) {
    return { panel: 'border-amber-500 bg-amber-50', badge: 'bg-amber-600' };
  }

  return { panel: 'border-slate-400 bg-slate-50', badge: 'bg-slate-600' };
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}
