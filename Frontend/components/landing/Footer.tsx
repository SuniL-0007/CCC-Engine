'use client';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                FC
              </div>
              <span className="text-lg font-bold text-primary">FabricCash</span>
            </div>
            <p className="text-sm text-slate-600">
              Built for textile mills across India: Surat, Tiruppur, Bhilwara, Panipat.
            </p>
          </div>

          <div className="flex gap-6 md:justify-end">
            <a href="/privacy" className="text-sm text-slate-600 hover:text-primary">
              Privacy Policy
            </a>
            <a href="/terms" className="text-sm text-slate-600 hover:text-primary">
              Terms of Use
            </a>
            <a href="mailto:hello@fabriccash.in" className="text-sm text-slate-600 hover:text-primary">
              Contact
            </a>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-8">
          <p className="text-center text-sm text-slate-600">
            Copyright {currentYear} FabricCash. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
