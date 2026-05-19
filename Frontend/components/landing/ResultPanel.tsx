'use client';

import { useState } from 'react';
import { CCCResult, Recommendation } from '@/lib/ccc-engine/types';

export function ResultPanel({ result }: { result: CCCResult }) {
  const [showSignUp, setShowSignUp] = useState(false);

  return (
    <div className="space-y-8">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="DIO"
          value={result.dio.value}
          benchmark={result.dio.benchmark}
          unit="days"
          tooltip="Days Inventory Outstanding - how long inventory sits before being sold"
        />
        <MetricCard
          label="DSO"
          value={result.dso.value}
          benchmark={result.dso.benchmark}
          unit="days"
          tooltip="Days Sales Outstanding - how long to collect payment from customers"
        />
        <MetricCard
          label="DPO"
          value={result.dpo.value}
          benchmark={result.dpo.benchmark}
          unit="days"
          tooltip="Days Payable Outstanding - how long you take to pay suppliers"
        />
        <MetricCard
          label="CCC"
          value={result.ccc}
          benchmark={result.benchmarkCCC}
          unit="days"
          tooltip="Cash Conversion Cycle = DIO + DSO - DPO"
        />
      </div>

      {/* Benchmark Banner */}
      <div
        className={`p-6 rounded-lg border-l-4 ${
          result.gapDays > 0 ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'
        }`}
      >
        <p className="font-bold text-lg mb-2">
          Your CCC: <span className={result.gapDays > 0 ? 'text-red-700' : 'text-green-700'}>
            {result.ccc.toFixed(1)} days
          </span>
        </p>
        <p className="text-sm text-gray-700">
          Industry benchmark: {result.benchmarkCCC} days
        </p>
        <p className="text-sm text-gray-700">
          Gap: {result.gapDays > 0 ? '+' : ''}{result.gapDays.toFixed(1)} days
        </p>
      </div>

      {/* Recommendations */}
      <div className="space-y-4">
        <h3 className="text-2xl font-bold text-gray-900">Top 5 Recommendations</h3>
        {result.recommendations && result.recommendations.length > 0 ? (
          <div className="space-y-3">
            {result.recommendations.map((rec, idx) => (
              <RecommendationCard key={rec.id} recommendation={rec} rank={idx + 1} />
            ))}
          </div>
        ) : (
          <p className="text-gray-600">Loading recommendations...</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col md:flex-row gap-4">
        <button
          onClick={() => downloadPDF(result)}
          className="btn-primary flex-1"
        >
          📥 Download Report (PDF)
        </button>
        <button
          onClick={() => setShowSignUp(true)}
          className="btn-secondary flex-1"
        >
          💾 Save Results
        </button>
      </div>

      {showSignUp && (
        <SignUpModal onClose={() => setShowSignUp(false)} />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  benchmark,
  unit,
  tooltip,
}: {
  label: string;
  value: number;
  benchmark: number;
  unit: string;
  tooltip: string;
}) {
  const isGood = value <= benchmark;

  return (
    <div className="card relative group">
      <p className="text-sm text-gray-600 mb-2">{label}</p>
      <p className={`text-3xl font-bold mb-1 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
        {value.toFixed(1)}
      </p>
      <p className="text-xs text-gray-500">
        Benchmark: {benchmark} {unit}
      </p>
      <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
        {tooltip}
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
  const priorityColor = {
    HIGH: 'red',
    MEDIUM: 'amber',
    LOW: 'gray',
  };

  const color = priorityColor[recommendation.priority];

  return (
    <div
      className={`p-4 border-l-4 rounded-lg ${
        color === 'red'
          ? 'border-red-500 bg-red-50'
          : color === 'amber'
            ? 'border-amber-500 bg-amber-50'
            : 'border-gray-400 bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3 mb-2">
        <span
          className={`inline-block px-2 py-1 rounded text-xs font-bold text-white ${
            color === 'red'
              ? 'bg-red-600'
              : color === 'amber'
                ? 'bg-amber-600'
                : 'bg-gray-600'
          }`}
        >
          {rank}. {recommendation.priority}
        </span>
      </div>
      <h4 className="font-bold text-gray-900 mb-1">{recommendation.title}</h4>
      <p className="text-sm text-gray-700 mb-2">{recommendation.explanation}</p>
      <div className="bg-white/50 rounded p-2 mb-2">
        <p className="text-xs font-mono text-gray-700">
          <strong>Impact:</strong> {recommendation.estimatedDaysReduction.toFixed(1)} days |{' '}
          <strong>Cash freed:</strong> ₹{recommendation.estimatedCashFreedLakhs.toFixed(1)}L
        </p>
      </div>
      <div className="text-xs text-gray-600">
        <strong>Action steps:</strong>
        <ol className="list-decimal list-inside mt-1 space-y-1">
          {recommendation.actionSteps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function SignUpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-2xl font-bold mb-4">Save Your Results</h3>
        <p className="text-gray-600 mb-6">
          Create an account to track your CCC over time and get personalized recommendations.
        </p>

        <form className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="text"
            placeholder="Company Name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="text"
            placeholder="City"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">Fabric Types</label>
            <div className="space-y-2">
              {['Cotton knit', 'Polyester blend', 'Technical textiles', 'Yarn', 'Fabric trading'].map(
                (type) => (
                  <label key={type} className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">{type}</span>
                  </label>
                )
              )}
            </div>
          </div>

          <p className="text-xs text-gray-600">
            🔒 We store only your aggregated CCC metrics, not your raw invoice data.
          </p>
        </form>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button className="btn-primary flex-1">Sign Up</button>
        </div>
      </div>
    </div>
  );
}

async function downloadPDF(result: CCCResult) {
  // Placeholder for PDF generation
  console.log('Downloading PDF with CCC result:', result);
  alert('PDF download feature coming soon!');
}
