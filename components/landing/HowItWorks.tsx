'use client';

import { UploadWidget, type RecommendationSource } from '@/components/landing/UploadWidget';
import { CCCResult, Recommendation } from '@/lib/ccc-engine/types';

const STEPS = [
  { step: 1, title: 'Export from Tally', desc: '30 seconds to export the three files' },
  { step: 2, title: 'Upload 3 files', desc: 'Parsing runs in your browser' },
  { step: 3, title: 'Get your CCC', desc: 'Metrics, benchmarks, actions, and a PDF report' },
];

export function HowItWorks({ onResultsReady }: { onResultsReady: (result: CCCResult, recommendations: Recommendation[], source: RecommendationSource) => void }) {
  return (
    <div className="space-y-12" id="how-it-works">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-ink md:text-4xl">How it works</h2>
        <p className="mx-auto mt-2 max-w-2xl text-body">Three simple steps. 60 seconds.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {STEPS.map((item) => (
          <div key={item.step} className="relative">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <span className="text-2xl font-bold text-primary">{item.step}</span>
              </div>
              <h3 className="mb-2 text-xl font-bold text-ink">{item.title}</h3>
              <p className="text-body">{item.desc}</p>
            </div>
            {item.step < 3 && (
              <div className="absolute right-[-18px] top-8 hidden text-2xl text-primary/30 md:block">
                -&gt;
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-4xl rounded-lg border border-edge bg-canvas p-5">
        <h3 className="mb-5 text-center text-xl font-bold text-ink">
          Still reading? Your cash is waiting.
        </h3>
        <UploadWidget onResultsReady={onResultsReady} />
      </div>
    </div>
  );
}
