'use client';

import { useState } from 'react';
import { Footer } from '@/components/landing/Footer';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Navbar } from '@/components/landing/Navbar';
import { ResultPanel } from '@/components/landing/ResultPanel';
import { TallyGuide } from '@/components/landing/TallyGuide';
import { UploadWidget, type RecommendationSource } from '@/components/landing/UploadWidget';
import type { CCCResult, Recommendation } from '@/lib/ccc-engine/types';

export default function Home() {
  const [showResults, setShowResults] = useState(false);
  const [cccResult, setCCCResult] = useState<CCCResult | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationSource, setRecommendationSource] = useState<RecommendationSource>('fallback');

  const handleResultsReady = (
    result: CCCResult,
    recommendations: Recommendation[],
    source: RecommendationSource
  ) => {
    setCCCResult(result);
    setRecommendations(recommendations);
    setRecommendationSource(source);
    setShowResults(true);
    window.setTimeout(() => {
      document.getElementById('result-panel')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <main className="min-h-screen bg-canvas">
      <Navbar />

      <section className="relative w-full overflow-hidden bg-surface px-4 py-16 md:py-20 border-b border-edge">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#2563EB 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.04 }} />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-6">
                <span className="inline-block rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[9px] font-medium text-[#2563EB] dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-400 mb-6">
                  ✦ Free for Indian textile mills
                </span>
                <h1 className="text-[48px] font-bold leading-[1.1] tracking-[-0.04em] text-ink">
                  Find out how much cash is trapped in your business.
                </h1>
                <p className="mt-5 max-w-md text-[14px] leading-relaxed text-body">
                  Upload your Tally or Excel export. Get your Cash Conversion Cycle score and ranked recommendations in under 60 seconds.
                </p>
              </div>
              
              <div className="mt-8 flex gap-4">
                <button type="button" onClick={() => document.querySelector('[data-upload-widget]')?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary">
                  Upload your file →
                </button>
                <a href="#how-it-works" className="btn-secondary">
                  See how it works
                </a>
              </div>

              <div className="mt-12 flex gap-8 border-t border-edge pt-6">
                <div>
                  <div className="text-xl font-semibold text-ink">90d</div>
                  <div className="text-[10px] text-faint uppercase tracking-wider mt-1">Period analysed</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-ink">5</div>
                  <div className="text-[10px] text-faint uppercase tracking-wider mt-1">Recommendations</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-ink">Free</div>
                  <div className="text-[10px] text-faint uppercase tracking-wider mt-1">Always</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-ink">3</div>
                  <div className="text-[10px] text-faint uppercase tracking-wider mt-1">Files needed</div>
                </div>
              </div>
            </div>

            <div>
              <UploadWidget onResultsReady={handleResultsReady} />
            </div>
          </div>
        </div>
      </section>

      <section className="w-full border-b border-edge bg-surface py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-6 text-faint">
          {['Tally', 'Zoho Books', 'Busy', 'Excel'].map((logo) => (
            <span key={logo} className="rounded border border-edge bg-surface2 px-3 py-1 text-xs font-medium text-body">
              {logo}
            </span>
          ))}
        </div>
      </section>

      <section className="w-full bg-surface px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <TallyGuide />
        </div>
      </section>

      <section id="result-panel" className="w-full bg-canvas px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <ResultPanel
            result={cccResult}
            recommendations={recommendations}
            source={recommendationSource}
            visible={showResults}
          />
        </div>
      </section>

      <section className="w-full bg-surface px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <HowItWorks onResultsReady={handleResultsReady} />
        </div>
      </section>

      <Footer />
    </main>
  );
}
