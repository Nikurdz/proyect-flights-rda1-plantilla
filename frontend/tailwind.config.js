import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // RAM Alliance: black chrome, one gold accent, light neutral surfaces.
        brand: {
          black: '#0B0E14',
          dark: '#05070A',
          navy: '#0F172A',
          gold: '#AB9159',
          'gold-light': '#F4EFE4',
          'gold-dark': '#8C7547',
          silver: '#94A3B8',
          blue: '#0369A1',
          'blue-light': '#E0F2FE',
        },
        airline: {
          navy: '#0B0E14',
          'navy-dark': '#05070A',
          'navy-light': '#1E293B',
          blue: '#0369A1',
          'blue-light': '#E0F2FE',
          gold: '#AB9159',
          'gold-hover': '#8C7547',
          coral: '#D4AF37',
          sky: '#38BDF8',
          sand: '#F8FAFC',
          border: '#E2E8F0',
          muted: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(11, 14, 20, 0.06)',
        card: '0 2px 10px -2px rgba(11, 14, 20, 0.06), 0 4px 16px -4px rgba(11, 14, 20, 0.04)',
        'card-hover': '0 8px 24px -4px rgba(11, 14, 20, 0.12), 0 4px 12px -2px rgba(11, 14, 20, 0.06)',
        elevated: '0 16px 36px -4px rgba(11, 14, 20, 0.18)',
      },
      keyframes: {
        pulseFast: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        flashGold: {
          '0%': { backgroundColor: 'rgba(212, 175, 55, 0.35)' },
          '100%': { backgroundColor: 'rgba(212, 175, 55, 0)' },
        },
      },
      animation: {
        'flash-gold': 'flashGold 600ms ease-out',
        'pulse-fast': 'pulseFast 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [animate],
};
