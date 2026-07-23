/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      borderRadius: {
        sm:   'var(--r-sm)',    /* 8px  — inputs, chips */
        md:   'var(--r-md)',    /* 12px — buttons */
        lg:   'var(--r-lg)',    /* 16px — cards */
        xl:   'var(--r-xl)',    /* 24px — sheets, modals */
        full: 'var(--r-full)', /* 9999px — pills, avatars */
      },
      colors: {
        /* ── OFFSZN surface ladder ── */
        's0': 'var(--surface-0)',
        's1': 'var(--surface-1)',
        's2': 'var(--surface-2)',
        's3': 'var(--surface-3)',

        /* ── Cone Orange — the ONE accent ── */
        accent: {
          DEFAULT:  'var(--accent)',
          hover:    'var(--accent-hover)',
          pressed:  'var(--accent-pressed)',
          subtle:   'var(--accent-subtle)',
          on:       'var(--on-accent)',
        },

        /* ── Semantic colors — meaning only, never decoration ── */
        positive: 'var(--positive)',
        warning:  'var(--warning)',
        negative: 'var(--negative)',

        /* ── Text hierarchy ── */
        'tx-primary':   'var(--text-primary)',
        'tx-secondary': 'var(--text-secondary)',
        'tx-tertiary':  'var(--text-tertiary)',

        /* shadcn aliases — keep for UI library components */
        background: 'var(--surface-0)',
        foreground: 'var(--text-primary)',
        card: {
          DEFAULT:    'var(--surface-1)',
          foreground: 'var(--text-primary)',
        },
        popover: {
          DEFAULT:    'var(--surface-2)',
          foreground: 'var(--text-primary)',
        },
        primary: {
          DEFAULT:    'var(--accent)',
          foreground: 'var(--on-accent)',
        },
        secondary: {
          DEFAULT:    'var(--surface-2)',
          foreground: 'var(--text-primary)',
        },
        muted: {
          DEFAULT:    'var(--surface-2)',
          foreground: 'var(--text-tertiary)',
        },
        destructive: {
          DEFAULT:    'var(--negative)',
          foreground: 'var(--text-primary)',
        },
        border:  'var(--border-subtle)',
        input:   'var(--surface-1)',
        ring:    'var(--accent)',

        /* Legacy — kept so old component inline-color refs don't explode */
        page: 'var(--surface-1)',
        'page-alt': 'var(--surface-2)',
        cover: 'var(--surface-1)',
        'cover-lift': 'var(--surface-2)',
        ink: 'var(--text-primary)',
        'ink-soft': 'var(--text-secondary)',
        'field-line': 'var(--text-primary)',
        chrome: { light: '#838B94', dark: '#4C5258' },
      },
      fontFamily: {
        display: ['Archivo Black', 'Anton', 'sans-serif'],
        anton:   ['Archivo Black', 'Anton', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
        work:    ['Inter', 'system-ui', 'sans-serif'],
        /* Legacy aliases */
        barlow:  ['Archivo Black', 'Anton', 'sans-serif'],
        elite:   ['Inter', 'system-ui', 'sans-serif'],
        marker:  ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem',     { lineHeight: '1.5rem' }],
        'lg':   ['1.125rem', { lineHeight: '1.625rem' }],
        'xl':   ['1.375rem', { lineHeight: '1.75rem' }],
        '2xl':  ['1.75rem',  { lineHeight: '2.125rem' }],
        '3xl':  ['2rem',     { lineHeight: '2.375rem' }],
        '4xl':  ['2.5rem',   { lineHeight: '2.75rem' }],
        '5xl':  ['3rem',     { lineHeight: '1' }],
        'hero': ['4rem',     { lineHeight: '1' }],
      },
      spacing: {
        /* 4pt grid — only these values in components */
        '0':  '0',
        '1':  '0.25rem',  /* 4px  */
        '2':  '0.5rem',   /* 8px  */
        '3':  '0.75rem',  /* 12px */
        '4':  '1rem',     /* 16px */
        '5':  '1.25rem',  /* 20px */
        '6':  '1.5rem',   /* 24px */
        '8':  '2rem',     /* 32px */
        '10': '2.5rem',   /* 40px */
        '12': '3rem',     /* 48px */
        '16': '4rem',     /* 64px */
        /* Allow non-grid for absolute positioning / layouts */
        '0.5': '0.125rem',
        '1.5': '0.375rem',
        '2.5': '0.625rem',
        '3.5': '0.875rem',
        '14': '3.5rem',
        '18': '4.5rem',
        '20': '5rem',
        '24': '6rem',
        '32': '8rem',
        '40': '10rem',
        '48': '12rem',
        '56': '14rem',
        '64': '16rem',
        '72': '18rem',
        '80': '20rem',
        '96': '24rem',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'slide-up':       { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'count-up':       { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'stamp-in':       { '0%': { transform: 'scale(1.2)', opacity: '0' }, '60%': { transform: 'scale(0.97)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'page-flip':      { '0%': { transform: 'rotateY(-6deg)', opacity: '0.7' }, '100%': { transform: 'rotateY(0deg)', opacity: '1' } },
        'shimmer':        { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        'celebrate':      { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.06)' }, '70%': { transform: 'scale(0.98)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'slide-up':       'slide-up 0.25s cubic-bezier(0.2,0,0,1)',
        'count-up':       'count-up 0.25s cubic-bezier(0.2,0,0,1)',
        'stamp-in':       'stamp-in 0.25s cubic-bezier(0.2,0,0,1)',
        'page-flip':      'page-flip 0.25s cubic-bezier(0.2,0,0,1)',
        'shimmer':        'shimmer 1.6s ease-in-out infinite',
        'celebrate':      'celebrate 0.5s cubic-bezier(0.2,0,0,1)',
      },
    }
  },
  plugins: [require("tailwindcss-animate")],
  safelist: [
    /* Dynamic class names used at runtime */
    'surface-0', 'surface-1', 'surface-2', 'surface-3',
    'btn-primary', 'btn-stamp', 'btn-secondary',
    'card-base', 'card-tappable',
    'skeleton', 'eyebrow', 'stat-number', 'ink-stamp',
    'glass-sheet', 'glass-panel', 'glass-chip',
    'text-positive', 'text-warning', 'text-negative',
    'bg-positive', 'bg-warning', 'bg-negative',
    'accent-bg', 'turf-texture', 'field-lines', 'stadium-header',
    'tabular-nums',
    'rotate-1', '-rotate-1', 'rotate-2', '-rotate-2', '-rotate-3',
    'animate-celebrate', 'animate-stamp-in', 'animate-slide-up',
  ],
}
