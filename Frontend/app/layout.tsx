import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'FabricCash - Textile CCC Optimization',
  description: 'Find out in 60 seconds how much cash is trapped in your textile business.',
  keywords: ['textile', 'cash conversion cycle', 'working capital', 'India'],
  authors: [{ name: 'FabricCash' }],
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1B3A6B',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-white text-gray-900">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { fontFamily: 'inherit' },
          }}
        />
      </body>
    </html>
  );
}
