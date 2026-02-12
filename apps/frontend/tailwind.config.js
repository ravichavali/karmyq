/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /* ── Semantic design tokens (CSS-variable backed) ── */
      colors: {
        // Primary brand
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          light: 'rgb(var(--color-primary-light) / <alpha-value>)',
          medium: 'rgb(var(--color-primary-medium) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
        },
        // Secondary accent
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          light: 'rgb(var(--color-accent-light) / <alpha-value>)',
          dark: 'rgb(var(--color-accent-dark) / <alpha-value>)',
        },
        // Surfaces
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          raised: 'rgb(var(--color-surface-raised) / <alpha-value>)',
        },
        // Text
        text: {
          DEFAULT: 'rgb(var(--color-text) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          subtle: 'rgb(var(--color-text-subtle) / <alpha-value>)',
        },
        // Borders
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          light: 'rgb(var(--color-border-light) / <alpha-value>)',
        },
        // Status
        warn: {
          DEFAULT: 'rgb(var(--color-warn) / <alpha-value>)',
          light: 'rgb(var(--color-warn-light) / <alpha-value>)',
        },
        error: {
          DEFAULT: 'rgb(var(--color-error) / <alpha-value>)',
          light: 'rgb(var(--color-error-light) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          light: 'rgb(var(--color-success-light) / <alpha-value>)',
        },

        /* ── Direct karmyq palette (for request types, trust scores, etc.) ── */
        karmyq: {
          green: {
            50: '#f0f7f0',
            100: '#dceddc',
            200: '#b8dab6',
            300: '#88bf84',
            400: '#5ea358',
            500: '#3d8b35',
            600: '#2d6e28',
            700: '#245621',
            800: '#1f451d',
            900: '#1a391a',
          },
          orange: {
            50: '#fef7ee',
            100: '#fdedd7',
            200: '#fad7ae',
            300: '#f6b97a',
            400: '#f19344',
            500: '#ed7620',
            600: '#de5d16',
            700: '#b84614',
            800: '#933818',
            900: '#773016',
          },
          brown: {
            50: '#faf6f1',
            100: '#f2eade',
            200: '#e4d3bc',
            300: '#d3b693',
            400: '#c19a6f',
            500: '#b48455',
            600: '#a7724a',
            700: '#8b5b3f',
            800: '#714a38',
            900: '#5c3e30',
          },
          teal: {
            50: '#effcf9',
            100: '#d8f7f0',
            200: '#b4ede2',
            300: '#82ddd0',
            400: '#4ec5b8',
            500: '#33a99e',
            600: '#268882',
            700: '#226d69',
            800: '#205755',
            900: '#1f4947',
          },
          cream: '#faf8f3',
          warmWhite: '#fdfcf9',
        },
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
