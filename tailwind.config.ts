import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        secondary: '#475569',
        accent: '#2563EB',
        warning: '#D97706',
        success: '#059669',
        danger: '#DC2626',
        info: '#2563EB',
        dark: '#0F172A',
        light: '#F8FAFC',
        muted: '#94A3B8',
        border: '#E2E8F0',
      },
      fontFamily: {
        sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};

export default config;
