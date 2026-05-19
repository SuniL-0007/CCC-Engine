'use client';

export function HowItWorks() {
  return (
    <div className="space-y-12" id="how-it-works">
      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">How it works</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Three simple steps. 60 seconds. That&apos;s it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {[
          { step: 1, title: 'Export from Tally', desc: '30 seconds to export 3 files' },
          { step: 2, title: 'Upload 3 files', desc: 'We parse them in your browser' },
          { step: 3, title: 'Get your CCC', desc: 'Instant results + AI recommendations' },
        ].map((item) => (
          <div key={item.step} className="relative">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-primary">{item.step}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600">{item.desc}</p>
            </div>
            {item.step < 3 && (
              <div className="hidden md:block absolute top-8 -right-4 text-2xl text-primary/30">→</div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center">
        <p className="text-gray-600 mb-6 text-lg">Still reading? Your cash is waiting.</p>
        <div className="inline-block">
          <button
            onClick={() => document.querySelector('[data-upload-widget]')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn-primary"
          >
            Get Started Now &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
