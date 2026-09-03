import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Docker-inspired Dark Steel / Charcoal palette (Eliminating all purple/indigo tint)
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#283344',
          800: '#1c2430',
          900: '#11161d',
          950: '#0b0e14',
        },
        docker: {
          blue: '#1d63ed',
          cyan: '#0db7ed',
          bg: '#0b0e14',
          surface: '#11161d',
          card: '#1c2430',
          border: '#283344',
        },
      },
    },
  },
  plugins: [],
};
export default config;
