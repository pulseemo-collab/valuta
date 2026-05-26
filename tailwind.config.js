/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#060B18',
        surface: '#0D1525',
        card: '#0F1B2D',
        elevated: '#162035',
        border: '#1E2D45',
        primary: '#10B981',
        'primary-light': '#34D399',
        'primary-dark': '#059669',
        accent: '#3B82F6',
        'accent-light': '#60A5FA',
        tx: '#F1F5F9',
        'tx-sub': '#94A3B8',
        'tx-muted': '#475569',
        danger: '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
