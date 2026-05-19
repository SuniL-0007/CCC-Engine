'use client';

import { Navbar } from '@/components/landing/Navbar';
import { UploadWidget } from '@/components/landing/UploadWidget';
import { TallyGuide } from '@/components/landing/TallyGuide';
import { ResultPanel } from '@/components/landing/ResultPanel';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Footer } from '@/components/landing/Footer';
import { CCCResult } from '@/lib/ccc-engine/types';
import { useState } from 'react';

export default function Home() {
  const [showResults, setShowResults] = useState(false);
  const [cccResult, setCCCResult] = useState<CCCResult | null>(null);

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      
      {/* S2: Hero + Upload Widget */}
      <section className="relative w-full py-20 px-4 bg-gradient-to-b from-primary/5 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-5xl md:text-6xl font-bold text-primary mb-4">
              Find out in 60 seconds
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 max-w-2xl mx-auto">
              how much cash is trapped in your textile business.
            </p>
          </div>
          
          <div className="mb-4 text-center">
            <p className="text-lg text-gray-600 mb-6">
              Upload your Tally or Zoho Books export. Get your Cash Conversion Cycle instantly.
            </p>
            <UploadWidget 
              onResultsReady={(result) => {
                setCCCResult(result);
                setShowResults(true);
                // Scroll to results
                setTimeout(() => {
                  document.getElementById('result-panel')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
            />
            <p className="text-sm text-gray-500 mt-4">
              🔒 Your file is processed in your browser. Nothing is uploaded.
            </p>
          </div>
        </div>
      </section>

      {/* S3: Tally Export Guide */}
      <section className="w-full py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <TallyGuide />
        </div>
      </section>

      {/* S4: Live Result Panel */}
      {showResults && cccResult && (
        <section id="result-panel" className="w-full py-16 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <ResultPanel result={cccResult} />
          </div>
        </section>
      )}

      {/* S5: How It Works */}
      <section className="w-full py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <HowItWorks />
        </div>
      </section>

      {/* S7: Footer */}
      <Footer />
    </main>
  );
}
