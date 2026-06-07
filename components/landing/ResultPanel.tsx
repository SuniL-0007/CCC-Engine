'use client';

import { useState } from 'react';
import type { CCCResult, Recommendation, Layer1Candidate } from '@/lib/ccc-engine/types'
import { generateCCCReport } from '@/lib/report/pdfGenerator'
import { evaluateLayer1 } from '@/lib/recommendations/layer1Rules'

type MetricDimension = 'DIO' | 'DSO' | 'DPO' | 'CCC';

// Convert Layer1Candidate to Recommendation with default values
function convertToRecommendation(candidate: Layer1Candidate): Recommendation {
  const priorityMap = (p: number): Recommendation['priority'] =>
    p >= 8 ? 'HIGH' : p >= 5 ? 'MEDIUM' : 'LOW';

  return {
    id: candidate.id,
    dimension: candidate.dimension,
    priority: priorityMap(Number(candidate.priority)),
    title: candidate.title,
    explanation: `Your ${candidate.dimension} metric is outside the textile benchmark. Addressing this could reduce your CCC by approximately ${candidate.estimatedDaysReduction} days.`,
    actionSteps: [
      `Review your ${candidate.dimension} data for the past 30 days`,
      `Identify the top 3 counterparties contributing to this gap`,
      `Create an action plan to address the root causes`
    ],
    estimatedDaysReduction: candidate.estimatedDaysReduction,
    estimatedCashFreedLakhs: Math.round(candidate.estimatedDaysReduction * 0.5 * 10) / 10,
  };
}

export function ResultPanel({
  result,
  recommendations,
  visible,
}: {
  result: CCCResult | null;
  recommendations?: Recommendation[];
  visible: boolean;
}) {
  const activeRecommendations =
    recommendations && recommendations.length > 0
      ? recommendations
      : result
        ? evaluateLayer1(result).map(convertToRecommendation)
        : [];

  return (
    <div className={`overflow-hidden transition-all duration-500 ${visible ? 'opacity-100 h-auto' : 'opacity-0 h-0'
      }`}
    >
      {result ? (
        <div className="space-y-8">

          <div className="flex flex-col md:flex-row items-center justify-between rounded-xl bg-[#0F172A] p-6 text-white shadow-lg">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
                {result.gapDays > 0 ? 'CCC is above benchmark' : 'CCC is within benchmark'}
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <h2 className="text-4xl font-bold tracking-tight">{result.ccc.toFixed(1)}<span className="text-xl font-medium text-[#94A3B8]">d</span></h2>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${result.gapDays > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {result.gapDays > 0 ? `+${result.gapDays.toFixed(1)}d over avg` : `${Math.abs(result.gapDays).toFixed(1)}d vs avg`}
                </span>
              </div>
              <p className="mt-3 text-[13px] text-[#94A3B8]">
                Estimated <span className="font-semibold text-white">Rs {estimateCashLocked(result)} lakhs</span> locked. Analysis period: {result.periodDays} days.
              </p>
            </div>
            <div className="mt-6 w-full md:mt-0 md:w-auto">
              <button
                type="button"
                onClick={() => generateCCCReport(result)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[7px] border border-[#475569] bg-[#1E293B] px-6 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#334155] md:w-auto"
              >
                <span>Download Report</span>
                <span className="text-[#94A3B8]">↓</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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
              isSummary
            />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-950">Top Recommendations</h3>
              <p className="mt-1 text-sm text-slate-600">
                Ranked by estimated cash-cycle impact. Never more than five actions.
              </p>
            </div>
            {activeRecommendations.length > 0 ? (
              <div className="space-y-3">
                {activeRecommendations.slice(0, 5).map((recommendation, index) => (
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
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  benchmark,
  direction,
  definition,
  isSummary = false,
}: {
  label: MetricDimension;
  value: number;
  benchmark: number;
  direction: 'lower' | 'higher';
  definition: string;
  isSummary?: boolean;
}) {
  const isGood = direction === 'lower' ? value <= benchmark : value >= benchmark;
  const gap = Math.abs(value - benchmark);
  const gapText = isGood ? `−${gap.toFixed(0)}d ✓` : `+${gap.toFixed(0)}d ↑`;
  const progressPercent = Math.min((value / (benchmark * 2)) * 100, 100);

  return (
    <div className={`group relative rounded-[10px] border ${isSummary ? 'border-red-200 bg-[#FFF5F5]' : 'border-[#E2E8F0] bg-white'} p-5 shadow-sm ${isSummary ? 'col-span-2 lg:col-span-2' : 'col-span-1 lg:col-span-1'}`}>
      <div className="mb-3">
        <p className="text-[11px] font-semibold text-[#94A3B8]">{label}</p>
      </div>
      <p className={`text-[32px] font-bold leading-none ${isGood ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
        {value.toFixed(1)}<span className="text-[14px] font-normal text-[#94A3B8]">d</span>
      </p>
      <p className="mt-2 text-[10px] text-[#94A3B8]">
        Avg: {benchmark}d · <span className={isGood ? 'text-[#059669] font-medium' : 'text-[#DC2626] font-medium'}>{gapText}</span>
      </p>
      <div className="mt-4 h-[3px] w-full rounded-full bg-[#E2E8F0]">
        <div 
          className={`h-full rounded-full ${isGood ? 'bg-[#059669]' : 'bg-[#DC2626]'}`} 
          style={{ width: `${progressPercent}%` }} 
        />
      </div>
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
  recommendation: Recommendation;
  rank: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const priorityColor = recommendation.priority === 'HIGH' ? '#DC2626' : recommendation.priority === 'MEDIUM' ? '#D97706' : '#94A3B8';

  return (
    <div 
      className="flex gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all"
      style={{ animation: `slideUp 0.5s ease-out ${rank * 0.1}s both` }}
    >
      <div className="flex min-w-[36px] flex-col items-center gap-1">
        <div 
          className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: priorityColor }}
        >
          {rank}
        </div>
        <div className="text-[9px] font-medium uppercase tracking-wider text-[#94A3B8]">{recommendation.dimension}</div>
        <div className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priorityColor }} />
      </div>

      <div className="flex-1">
        <h4 className="text-[14px] font-semibold text-[#0F172A]">{recommendation.title}</h4>
        <p className="mt-1 text-[12px] leading-relaxed text-[#475569]">{recommendation.explanation}</p>
        
        <div className="mt-3">
          <span className="inline-block rounded bg-[#F0FDF4] px-2 py-1 text-[10px] font-semibold text-[#15803D]">
            −{recommendation.estimatedDaysReduction.toFixed(1)} days · Rs {recommendation.estimatedCashFreedLakhs.toFixed(1)}L freed
          </span>
        </div>

        <button 
          onClick={() => setExpanded(!expanded)} 
          className="mt-3 text-[11px] font-medium text-[#2563EB] hover:underline"
        >
          {expanded ? 'Hide steps ↑' : 'Show steps →'}
        </button>

        {expanded && (
          <div className="mt-4 rounded-lg bg-[#F8FAFC] p-4 text-[12px] text-[#475569]">
            <p className="mb-2 font-semibold text-[#0F172A]">Action steps</p>
            <ol className="list-inside list-decimal space-y-2">
              {recommendation.actionSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function estimateCashLocked(result: CCCResult): number {
  return Math.max(Math.round(result.gapDays * 0.5 * 10) / 10, 0);
}
