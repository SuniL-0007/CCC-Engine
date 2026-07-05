export const metadata = {
  title: 'Terms of Use - FabricCash',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-ink mb-2">Terms of Use</h1>
        <p className="text-sm text-faint mb-10">Last updated: July 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-body">
          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">1. What FabricCash is</h2>
            <p>
              FabricCash is a free tool that calculates your Cash Conversion Cycle (CCC) from
              accounting exports and suggests ways to improve working capital, benchmarked against
              Indian textile industry averages. It is provided as-is, free of charge, for anyone who
              wants to understand and improve their company&apos;s cash cycle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">2. Not financial advice</h2>
            <p>
              The metrics, benchmarks, estimated cash figures, and recommendations produced by
              FabricCash — including AI-generated recommendations — are directional guidance for
              internal planning only. They are not financial, legal, tax, or investment advice.
              Benchmarks are references based on published SME textile industry data and may not
              reflect your specific situation. Always review significant financial decisions with
              your accountant or financial advisor.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">3. Accuracy depends on your data</h2>
            <p>
              Calculations are only as accurate as the files you upload. Missing columns, partial
              date ranges, or estimated COGS (when purchase data is unavailable, we assume a 65%
              cost-of-goods ratio typical for textiles) will affect results. Data-quality warnings
              are shown in the report where relevant.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">4. Acceptable use</h2>
            <p>
              You may use FabricCash only with data you are authorised to analyse. You must not
              attempt to disrupt the service, misuse the recommendation API, or use the service for
              unlawful purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">5. No warranty; limitation of liability</h2>
            <p>
              The service is provided &quot;as is&quot; without warranties of any kind. To the fullest
              extent permitted by law, FabricCash and its creators are not liable for any losses or
              damages arising from use of the tool or reliance on its output.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">6. Changes</h2>
            <p>
              We may update the tool and these terms over time. Continued use after changes
              constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">7. Contact</h2>
            <p>
              Questions? Email{' '}
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
