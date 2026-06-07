'use client';

import { useState } from 'react';
import { Footer } from '@/components/landing/Footer';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Navbar } from '@/components/landing/Navbar';
import { ResultPanel } from '@/components/landing/ResultPanel';
import { TallyGuide } from '@/components/landing/TallyGuide';
import { UploadWidget } from '@/components/landing/UploadWidget';
import type { CCCResult, Recommendation } from '@/lib/ccc-engine/types';

export default function Home() {
  const [showResults, setShowResults] = useState(false);
  const [cccResult, setCCCResult] = useState<CCCResult | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const handleResultsReady = (result: CCCResult, recommendations: Recommendation[]) => {
    setCCCResult(result);
    setRecommendations(recommendations);
    setShowResults(true);
    window.setTimeout(() => {
      document.getElementById('result-panel')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <section className="relative w-full overflow-hidden bg-white px-4 py-16 md:py-20 border-b border-[#E2E8F0]">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#2563EB 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.04 }} />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-6">
                <span className="inline-block rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[9px] font-medium text-[#2563EB] mb-6">
                  ✦ Free for Indian textile mills
                </span>
                <h1 className="text-[48px] font-bold leading-[1.1] tracking-[-0.04em] text-[#0F172A]">
                  Find out how much cash is trapped in your business.
                </h1>
                <p className="mt-5 max-w-md text-[14px] leading-relaxed text-[#475569]">
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

              <div className="mt-12 flex gap-8 border-t border-[#E2E8F0] pt-6">
                <div>
                  <div className="text-xl font-semibold text-[#0F172A]">90d</div>
                  <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider mt-1">Period analysed</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-[#0F172A]">5</div>
                  <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider mt-1">Recommendations</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-[#0F172A]">Free</div>
                  <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider mt-1">Always</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-[#0F172A]">3</div>
                  <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider mt-1">Files needed</div>
                </div>
              </div>
            </div>

            <div>
              <UploadWidget onResultsReady={handleResultsReady} />
            </div>
          </div>
        </div>
      </section>

      <section className="w-full border-b border-[#E2E8F0] bg-white py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-6 text-[#94A3B8]">
          {['Tally', 'Zoho Books', 'Busy', 'Excel'].map((logo) => (
            <span key={logo} className="rounded border border-[#E2E8F0] bg-slate-50 px-3 py-1 text-xs font-medium text-[#475569]">
              {logo}
            </span>
          ))}
        </div>
      </section>

      <section className="w-full bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <TallyGuide />
        </div>
      </section>

      <section id="result-panel" className="w-full bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <ResultPanel
            result={cccResult}
            recommendations={recommendations}
            visible={showResults}
          />
        </div>
      </section>

      <section className="w-full bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <HowItWorks onResultsReady={handleResultsReady} />
        </div>
      </section>

      <Footer />
    </main>
  );
}
