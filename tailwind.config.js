/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        // ── OFFSZN Field palette ──
        background: '#0A0B0D',       // pre-dawn near-black
        foreground: '#F5F5F0',       // chalk white
        page: '#181A1C',             // steel-gray card
        'page-alt': '#212326',       // lifted steel
        cover: '#181A1C',
        'cover-lift': '#212326',
        ink: '#F5F5F0',              // chalk white on dark
        'ink-soft': '#848A8F',       // muted steel

        // Single accent — Turf Green
        primary: {
          DEFAULT: '#00C853',
          foreground: '#0A0B0D',
        },
        chrome: {
          light: '#838B94',
          dark: '#4C5258',
        },
        // Field line white for decorative elements
        'field-line': '#F5F5F0',

        // shadcn aliases
        card: {
          DEFAULT: '#181A1C',
          foreground: '#F5F5F0',
        },
        popover: {
          DEFAULT: '#181A1C',
          foreground: '#F5F5F0',
        },
        secondary: {
          DEFAULT: '#212326',
          foreground: '#F5F5F0',
        },
        muted: {
          DEFAULT: '#212326',
          foreground: '#848A8F',
        },
        accent: {
          DEFAULT: '#00C853',
          foreground: '#0A0B0D',
        },
        destructive: {
          DEFAULT: '#E53935',
          foreground: '#F5F5F0',
        },
        border: '#2C2F33',
        input: '#212326',
        ring: '#00C853',
        sticky: '#F5F5F0',
      },
      fontFamily: {
        anton:   ['Anton', 'sans-serif'],
        elite:   ['Special Elite', 'cursive'],
        marker:  ['Permanent Marker', 'cursive'],
        work:    ['Work Sans', 'sans-serif'],
        // Legacy aliases
        barlow:  ['Anton', 'sans-serif'],
        mono:    ['Special Elite', 'cursive'],
        display: ['Anton', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'slide-up':       { from: { transform: 'translateY(20px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'count-up':       { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'stamp-in':       { '0%': { transform: 'scale(1.3)', opacity: '0' }, '60%': { transform: 'scale(0.97)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'page-flip':      { '0%': { transform: 'rotateY(-8deg)', opacity: '0.6' }, '100%': { transform: 'rotateY(0deg)', opacity: '1' } },
        'field-pulse':    { '0%, 100%': { boxShadow: '0 0 8px rgba(0,200,83,0.2)' }, '50%': { boxShadow: '0 0 20px rgba(0,200,83,0.45)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'slide-up':       'slide-up 0.35s cubic-bezier(0.16,1,0.3,1)',
        'count-up':       'count-up 0.4s ease-out',
        'stamp-in':       'stamp-in 0.3s cubic-bezier(0.16,1,0.3,1)',
        'page-flip':      'page-flip 0.25s ease-out',
        'field-pulse':    'field-pulse 2s ease-in-out infinite',
      },
    }
  },
  plugins: [require("tailwindcss-animate")],
  safelist: [
    'rotate-1', '-rotate-1', 'rotate-2', '-rotate-2', '-rotate-3',
    'text-primary', 'bg-primary', 'border-primary',
    'accent-glow', 'turf-texture', 'field-lines', 'stadium-header',
  ],
}
