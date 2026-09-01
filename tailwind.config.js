/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Tailwind stops at 2xl (1536px), so a 1920 or 2560 display had no breakpoint to
      // aim at and every layout stayed frozen in its 2xl arrangement. These match the two
      // sizes the workspace scale steps at in index.css, so type and layout grow together.
      screens: {
        '3xl': '1920px',
        '4xl': '2560px',
      },
      opacity: {
        8: '0.08',
        12: '0.12',
      },
      // ELEVATION. There was no `boxShadow` key, so 41+ sites hand-wrote
      // `shadow-[0_16px_42px_rgb(var(--shadow)/.14)]` and every panel invented its own
      // depth. Four steps, because a knowledge tool needs "flat", "raised", "floating"
      // and "overlay" — not a continuum. All keyed on --shadow so both themes track.
      boxShadow: {
        raised: '0 1px 2px rgb(var(--shadow) / .06)',
        overlay: '0 4px 12px rgb(var(--shadow) / .10)',
        popover: '0 8px 24px rgb(var(--shadow) / .14)',
        modal: '0 16px 40px rgb(var(--shadow) / .20)',
      },
      // Z-INDEX. ~20 sites used 10 unordered values from 1 to 10000, and Modal and
      // DialogProvider both sat at z-[100] — so a dialog opened over a modal was ordered
      // by DOM position alone. Named steps make the stack a decision instead of a guess.
      zIndex: {
        base: '1',
        sticky: '10',
        drawer: '30',
        overlay: '40',
        modal: '50',
        popover: '60',
        toast: '70',
        skip: '80',
      },
      // MOTION. Durations were hand-written across index.css and AskPage. Two speeds:
      // `fast` for state feedback the user must not wait on, `base` for entering surfaces.
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
      },
      transitionTimingFunction: {
        // Decelerating: quick to start so the response feels immediate, easing out so it
        // does not stop abruptly. One curve, because a workspace does not need a
        // motion vocabulary.
        standard: 'cubic-bezier(0.2, 0, 0.2, 1)',
      },
      // `font-mono` resolved to the system stack even though the app downloads and
      // serves four DM Mono cuts — so document IDs, source refs and code spans all
      // rendered in a face the product never chose.
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      spacing: {
        xxs: '0.25rem',
        xs: '0.5rem',
        sm: '0.75rem',
        md: '1rem',
        lg: '1.25rem',
        xl: '1.5rem',
        xxl: '2rem',
        xxxl: '2.5rem',
      },
      fontSize: {
        caption: ['0.6875rem', { lineHeight: '1rem' }],
        'body-sm': ['0.75rem', { lineHeight: '1.125rem' }],
        body: ['0.875rem', { lineHeight: '1.375rem' }],
        'body-lg': ['1rem', { lineHeight: '1.625rem' }],
        h4: ['1.125rem', { lineHeight: '1.5rem' }],
        h3: ['1.25rem', { lineHeight: '1.75rem' }],
        h2: ['1.5rem', { lineHeight: '2rem' }],
        h1: ['1.875rem', { lineHeight: '2.375rem' }],
      },
      borderRadius: {
        control: '0.5rem',
        surface: '0.75rem',
        panel: '1rem',
      },
      minHeight: {
        controlSm: '2rem',
        controlMd: '2.5rem',
        controlLg: '3rem',
      },
      minWidth: {
        controlSm: '2rem',
        controlMd: '2.5rem',
        controlLg: '3rem',
      },
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: 'rgb(var(--surface) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-elevated': 'rgb(var(--surface-elevated) / <alpha-value>)',
        'surface-muted': 'rgb(var(--surface-muted) / <alpha-value>)',
        'surface-soft': 'rgb(var(--surface-muted) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'border-soft': 'rgb(var(--border-soft) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--primary-foreground) / <alpha-value>)',
        'primary-strong': 'rgb(var(--primary-strong) / <alpha-value>)',
        'primary-muted': 'rgb(var(--primary-muted) / <alpha-value>)',
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        'secondary-foreground': 'rgb(var(--secondary-foreground) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-foreground': 'rgb(var(--accent-foreground) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        destructive: 'rgb(var(--destructive) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        // ON-FILL companions. Without these, `Button variant="danger"` reached for
        // `text-primary-foreground` — the PRIMARY on-fill token — on a destructive
        // surface, and RolesPage put `text-accent-foreground` on an info fill. Each
        // semantic fill now owns the text colour that is legible on top of it.
        'destructive-foreground': 'rgb(var(--destructive-foreground) / <alpha-value>)',
        'success-foreground': 'rgb(var(--success-foreground) / <alpha-value>)',
        'info-foreground': 'rgb(var(--info-foreground) / <alpha-value>)',
        'warning-foreground': 'rgb(var(--warning-foreground) / <alpha-value>)',
        // Modal/drawer backdrop. Six sites hand-rolled this as bg-black/40, /70, /35,
        // /75 — five of them theme-blind, so a light-theme dialog dimmed to near-black.
        scrim: 'rgb(var(--scrim) / <alpha-value>)',
        // ON-TINT TEXT. Use these whenever a semantic hue is text ON its own /10 tint —
        // status badges, inline state pills, tinted callouts. The fill tokens above stay
        // for solid surfaces; these are their readable counterparts on a tint.
        'primary-text': 'rgb(var(--primary-text) / <alpha-value>)',
        'success-text': 'rgb(var(--success-text) / <alpha-value>)',
        'warning-text': 'rgb(var(--warning-text) / <alpha-value>)',
        'destructive-text': 'rgb(var(--destructive-text) / <alpha-value>)',
        'info-text': 'rgb(var(--info-text) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        ink: 'rgb(var(--foreground) / <alpha-value>)',
        charcoal: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        slate: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        steel: 'rgb(var(--muted-foreground) / <alpha-value>)',
        stone: 'rgb(var(--muted) / <alpha-value>)',
        canvas: 'rgb(var(--background) / <alpha-value>)',
        hairline: 'rgb(var(--border) / <alpha-value>)',
        'hairline-soft': 'rgb(var(--border) / <alpha-value>)',
        coral: 'rgb(var(--destructive) / <alpha-value>)',
        magenta: '#ea5ec1',
        minimaxBlue: 'rgb(var(--primary) / <alpha-value>)',
        cyan: 'rgb(var(--info) / <alpha-value>)',
        purple: '#a855f7',
        brand: {
          50: 'rgb(var(--primary-soft) / <alpha-value>)',
          100: 'rgb(var(--primary-soft) / <alpha-value>)',
          300: 'rgb(var(--primary-muted) / <alpha-value>)',
          400: 'rgb(var(--primary-muted) / <alpha-value>)',
          500: 'rgb(var(--primary) / <alpha-value>)',
          600: 'rgb(var(--primary-strong) / <alpha-value>)',
          700: 'rgb(var(--primary-strong) / <alpha-value>)',
        }
      }
    },
  },
  plugins: [],
}
