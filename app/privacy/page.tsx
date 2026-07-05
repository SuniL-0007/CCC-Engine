import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - FabricCash',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-ink mb-2">Privacy Policy</h1>
        <p className="text-sm text-faint mb-10">Last updated: July 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-body">
          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">The short version</h2>
            <p>
              FabricCash is built privacy-first. Your accounting files never leave your device.
              There are no accounts, no logins, and no tracking of who you are.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">Your uploaded files stay in your browser</h2>
            <p>
              When you upload your Sales Register, Purchase Register, or Stock Summary, the files are
              read and parsed entirely inside your browser using client-side JavaScript. The raw
              files — including invoice rows, customer names, supplier names, and amounts — are never
              uploaded to our servers or to any third party.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">What does reach a server</h2>
            <p>
              To generate AI-personalised recommendations, we send only an aggregated summary of your
              analysis to our recommendation service: your calculated DIO, DSO, DPO, and CCC values,
              their gaps versus industry benchmarks, an estimated daily revenue figure, and the
              candidate recommendations produced by our rule engine. This summary is forwarded to
              Google&apos;s Gemini API to enrich the recommendations. It contains no invoice lines, no
              counterparty names, and nothing that identifies your company. If the AI service is
              unavailable, recommendations are generated entirely on your device instead.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">History stored on your device</h2>
            <p>
              Each analysis saves a small snapshot (date, period, and the four metric values) to your
              browser&apos;s local storage so the <Link href="/dashboard" className="text-[#2563EB] hover:underline">Dashboard</Link> can
              show your trend over time. This history lives only in your browser. You can erase it at
              any time with the &quot;Clear history&quot; button on the Dashboard, or by clearing your
              browser data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">Cookies, accounts, and analytics</h2>
            <p>
              FabricCash does not require an account, does not set advertising cookies, and does not
              sell or share data with anyone. Our hosting provider (Vercel) may collect standard
              server logs (such as IP addresses) needed to operate the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">PDF reports</h2>
            <p>
              The downloadable CCC report is generated inside your browser. It is saved directly to
              your device and is never transmitted to us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">Contact</h2>
            <p>
              Questions about this policy? Email{' '}
              <a href="mailto:hello@fabriccash.in" className="text-[#2563EB] hover:underline">
                hello@fabriccash.in
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
