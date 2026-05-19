'use client';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-gray-200 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-primary rounded-lg"></div>
              <span className="text-lg font-bold text-primary">FabricCash</span>
            </div>
            <p className="text-gray-600 text-sm">
              Built for textile mills across India — Surat, Tiruppur, Bhilwara, Panipat.
            </p>
          </div>

          {/* Links */}
          <div className="flex justify-end gap-8">
            <a
              href="/privacy"
              className="text-gray-600 hover:text-primary transition-colors text-sm"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="text-gray-600 hover:text-primary transition-colors text-sm"
            >
              Terms of Use
            </a>
            <a
              href="mailto:hello@fabriccash.in"
              className="text-gray-600 hover:text-primary transition-colors text-sm"
            >
              Contact
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-200 pt-8">
          <p className="text-gray-600 text-sm text-center">
            © {currentYear} FabricCash. All rights reserved. Built with ❤️ for Indian textile mills.
          </p>
        </div>
      </div>
    </footer>
  );
}
