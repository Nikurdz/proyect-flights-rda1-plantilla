import animate from 'tailwindcss-animate';

/** A color that reads a CSS variable ("R G B" triplet from src/styles/index.css) and supports `/opacity`. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const slate = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) => [step, v(`slate-${step}`)]),
);

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens (light and dark values live in the CSS variables).
        ink: v('ink'),
        'on-ink': v('on-ink'),
        muted: v('muted'),
        gold: v('gold'),
        'gold-text': v('gold-text'),
        'gold-soft': v('gold-soft'),
        'on-gold': v('on-gold'),
        paper: v('paper'),
        surface: v('surface'),
        line: v('line'),
        'line-strong': v('line-strong'),
        chrome: v('chrome'),
        success: v('success'),
        'success-soft': v('success-soft'),
        danger: v('danger'),
        'danger-soft': v('danger-soft'),
        'on-danger': v('on-danger'),
        warning: v('warning'),
        'warning-soft': v('warning-soft'),

        // Aliases so the pages that are not redesigned yet keep working. Prefer the tokens above.
        brand: {
          black: v('ink'),
          dark: '#05070A',
          navy: '#0F172A',
          gold: v('gold'),
          'gold-light': v('gold-soft'),
          'gold-dark': v('gold-text'),
          silver: v('muted'),
          blue: v('gold-text'),
          'blue-light': v('gold-soft'),
        },

        // Legacy bridge: slate flips in dark mode (see index.css). Do not use in new code.
        slate,
      },
      // `bg-white` is the surface color (white in light, panel color in dark); `text-white` stays white.
      backgroundColor: {
        white: v('surface'),
      },
      fontFamily: {
        sans: [
          '"Instrument Sans Variable"',
          '"Instrument Sans"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      // Type scale 1.25: 14 / 16 / 20 / 25 / 31 / 39 / 49 (the default xs/sm/base/lg steps stay for legacy pages).
      fontSize: {
        small: ['0.875rem', { lineHeight: '1.25rem' }],
        body: ['1rem', { lineHeight: '1.5rem' }],
        lead: ['1.25rem', { lineHeight: '1.75rem' }],
        title: ['1.5625rem', { lineHeight: '1.9rem', letterSpacing: '-0.01em' }],
        heading: ['1.9375rem', { lineHeight: '2.25rem', letterSpacing: '-0.015em' }],
        display: ['2.4375rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em' }],
        hero: ['3.0625rem', { lineHeight: '3.25rem', letterSpacing: '-0.025em' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(11, 14, 20, 0.06)',
        card: '0 1px 2px 0 rgba(11, 14, 20, 0.05)',
        'card-hover': '0 4px 12px -2px rgba(11, 14, 20, 0.10)',
        elevated: '0 16px 36px -8px rgba(11, 14, 20, 0.28), 0 2px 6px rgba(11, 14, 20, 0.10)',
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
