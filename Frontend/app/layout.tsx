import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FabricCash - Textile CCC Optimization',
  description: 'Find out in 60 seconds how much cash is trapped in your textile business.',
  keywords: ['textile', 'cash conversion cycle', 'working capital', 'India'],
  authors: [{ name: 'FabricCash' }],
  viewport: 'width=device-width, initial-scale=1.0',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://fabriccash.in',
    title: 'FabricCash - Textile CCC Optimization',
    description: 'Free AI-powered cash conversion cycle analysis for textile mills.',
    images: [
      {
        url: 'https://fabriccash.in/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#1B3A6B" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
