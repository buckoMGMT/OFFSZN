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
        background: '#0D0D0F',
        foreground: '#15151A',
        page: '#EDEEF0',
        'page-alt': '#DCDEE1',
        cover: '#1B1B1D',
        'cover-lift': '#272729',
        ink: '#15151A',
        'ink-soft': '#5A5D63',
        primary: {
          DEFAULT: '#D7263D',
          foreground: '#FFFFFF',
        },
        chrome: {
          light: '#9BA3AC',
          dark: '#5E646B',
        },
        sticky: '#FFD93D',
        card: {
          DEFAULT: '#EDEEF0',
          foreground: '#15151A',
        },
        popover: {
          DEFAULT: '#EDEEF0',
          foreground: '#15151A',
        },
        secondary: {
          DEFAULT: '#DCDEE1',
          foreground: '#15151A',
        },
        muted: {
          DEFAULT: '#DCDEE1',
          foreground: '#5A5D63',
        },
        accent: {
          DEFAULT: '#D7263D',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#D7263D',
          foreground: '#FFFFFF',
        },
        border: '#5E646B',
        input: '#DCDEE1',
        ring: '#D7263D',
      },
      fontFamily: {
        anton:  ['Anton', 'sans-serif'],
        elite:  ['Special Elite', 'cursive'],
        marker: ['Permanent Marker', 'cursive'],
        work:   ['Work Sans', 'sans-serif'],
        // Keep legacy names that existing code might reference
        barlow: ['Special Elite', 'cursive'],
        mono:   ['Special Elite', 'cursive'],
        display:['Anton', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'slide-up':       { from: { transform: 'translateY(20px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'count-up':       { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'stamp-in':       { '0%': { transform: 'rotate(-4deg) scale(1.4)', opacity: '0' }, '60%': { transform: 'rotate(-2deg) scale(0.96)' }, '100%': { transform: 'rotate(-2deg) scale(1)', opacity: '1' } },
        'page-flip':      { '0%': { transform: 'rotateY(-8deg)', opacity: '0.6' }, '100%': { transform: 'rotateY(0deg)', opacity: '1' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'slide-up':       'slide-up 0.35s cubic-bezier(0.16,1,0.3,1)',
        'count-up':       'count-up 0.4s ease-out',
        'stamp-in':       'stamp-in 0.3s cubic-bezier(0.16,1,0.3,1)',
        'page-flip':      'page-flip 0.25s ease-out',
      },
    }
  },
  plugins: [require("tailwindcss-animate")],
  safelist: [
    'rotate-1', '-rotate-1', 'rotate-2', '-rotate-2', '-rotate-3',
    'text-primary', 'bg-primary', 'border-primary',
  ],
}
