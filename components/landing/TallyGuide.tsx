'use client';

const STEPS = [
  {
    number: 1,
    name: 'Sales Register',
    path: 'Gateway -> Display -> Account Books -> Sales Register -> Alt+E -> Excel',
    info: 'Customer name, invoice date, invoice amount, due date, and payment date when available.',
  },
  {
    number: 2,
    name: 'Purchase Register',
    path: 'Gateway -> Display -> Account Books -> Purchase Register -> Alt+E -> Excel',
    info: 'Vendor name, bill date, bill amount, due date, and payment date when available.',
  },
  {
    number: 3,
    name: 'Stock Summary',
    path: 'Gateway -> Display -> Inventory Books -> Stock Summary -> Alt+E -> Excel',
    info: 'Stock item, closing quantity, rate, and closing stock value.',
  },
];

export function TallyGuide() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-ink md:text-4xl">How to export from Tally</h2>
        <p className="mt-2 text-body">Three quick exports. Takes about 2 minutes.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className="rounded-lg border-2 border-primary/20 bg-surface p-6 transition-colors hover:border-primary"
          >
            <div className="mb-4 text-4xl font-bold text-primary/20">{step.number}</div>
            <h3 className="mb-2 text-xl font-bold text-ink">{step.name}</h3>
            <p className="mb-3 rounded bg-surface2 p-3 font-mono text-xs leading-relaxed text-body">
              {step.path}
            </p>
            <p className="text-sm leading-6 text-body">{step.info}</p>
          </div>
        ))}
      </div>

      <div className="text-center">
        <p className="mb-4 text-body">Not on Tally?</p>
        <a
          href="/templates/fabriccash_templates.zip"
          download
          className="inline-flex min-h-11 items-center justify-center rounded-lg border-2 border-primary px-6 py-2 font-medium text-primary transition-colors hover:bg-primary hover:text-white"
        >
          Download Templates (.zip)
        </a>
      </div>
    </div>
  );
}
