'use client';

export function TallyGuide() {
  const steps = [
    {
      number: 1,
      name: 'Sales Register',
      path: 'Gateway → Display → Account Books → Sales Register → Alt+E → Excel',
      info: 'Customer invoices, dates, and payment status',
    },
    {
      number: 2,
      name: 'Purchase Register',
      path: 'Gateway → Display → Account Books → Purchase Register → Alt+E → Excel',
      info: 'Vendor invoices, dates, and payment status',
    },
    {
      number: 3,
      name: 'Stock Summary',
      path: 'Gateway → Display → Inventory Books → Stock Summary → Alt+E → Excel',
      info: 'Closing stock values and quantities',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          How to export from Tally
        </h2>
        <p className="text-gray-600">
          Three quick exports. Takes 2 minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step) => (
          <div key={step.number} className="card border-2 border-primary/20 hover:border-primary transition-colors">
            <div className="text-4xl font-bold text-primary/20 mb-4">{step.number}</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{step.name}</h3>
            <p className="text-xs font-mono text-gray-700 bg-gray-50 p-3 rounded mb-3 leading-relaxed">
              {step.path}
            </p>
            <p className="text-sm text-gray-600">{step.info}</p>
          </div>
        ))}
      </div>

      <div className="text-center">
        <p className="text-gray-600 mb-4">Not on Tally?</p>
        <a
          href="/fabriccash_template.xlsx"
          download
          className="inline-flex items-center gap-2 px-6 py-2 border-2 border-primary text-primary font-medium rounded-lg hover:bg-primary hover:text-white transition-colors"
        >
          <span>📥</span>
          Download Excel Template
        </a>
      </div>
    </div>
  );
}
