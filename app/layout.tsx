import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

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

// Applies the saved (or system) theme before first paint to avoid a flash of the wrong theme.
const themeInitScript = `(function(){try{var t=localStorage.getItem('fabriccash:theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} bg-canvas text-ink font-sans`}>
        {children}
      </body>
    </html>
  );
}
