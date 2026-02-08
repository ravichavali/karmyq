import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
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
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
