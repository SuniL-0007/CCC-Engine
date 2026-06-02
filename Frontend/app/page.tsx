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

      <section className="relative w-full overflow-hidden bg-white px-4 py-16 md:py-20">
        <div className="absolute inset-0 fabric-grid opacity-70" />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <div className="mb-6">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                  Textile working capital, simplified
                </p>
                <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
                  Find out in 60 seconds how much cash is trapped in your textile business.
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-slate-700">
                  Upload your Tally, Zoho Books or Excel export. We calculate CCC in the browser and give you benchmarked actions fast.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <UploadWidget onResultsReady={handleResultsReady} />
            </div>
          </div>
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
