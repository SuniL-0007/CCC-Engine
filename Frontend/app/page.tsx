'use client';

import { useState } from 'react';
import { Footer } from '@/components/landing/Footer';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Navbar } from '@/components/landing/Navbar';
import { ResultPanel } from '@/components/landing/ResultPanel';
import { TallyGuide } from '@/components/landing/TallyGuide';
import { UploadWidget } from '@/components/landing/UploadWidget';
import { CCCResult } from '@/lib/ccc-engine/types';

export default function Home() {
  const [showResults, setShowResults] = useState(false);
  const [cccResult, setCCCResult] = useState<CCCResult | null>(null);

  const handleResultsReady = (result: CCCResult) => {
    setCCCResult(result);
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
          <div className="mb-8 text-center">
            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-normal text-primary md:text-6xl">
              Find out in 60 seconds how much cash is trapped in your textile business.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-700 md:text-xl">
              Upload your Tally or Zoho Books export. Get your Cash Conversion Cycle instantly.
            </p>
          </div>

          <div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white/95 p-5 shadow-sm">
            <UploadWidget onResultsReady={handleResultsReady} />
            <p className="mt-4 text-center text-sm text-slate-500">
              Your file is processed in your browser. Nothing is uploaded.
            </p>
          </div>
        </div>
      </section>

      <section className="w-full bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <TallyGuide />
        </div>
      </section>

      {showResults && cccResult && (
        <section id="result-panel" className="w-full bg-slate-50 px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <ResultPanel result={cccResult} />
          </div>
        </section>
      )}

      <section className="w-full bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <HowItWorks onResultsReady={handleResultsReady} />
        </div>
      </section>

      <Footer />
    </main>
  );
}
