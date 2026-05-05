/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ck: {
          purple:  '#7C4DFF',
          violet:  '#6B3EED',
          sidebar: '#191B23',
          hover:   'rgba(255,255,255,0.05)',
          active:  'rgba(124,77,255,0.12)',
          border:  'rgba(255,255,255,0.07)',
          text:    '#8C8FA8',
          label:   '#4A4D5E',
          bg:      '#F7F8FA',
          card:    '#FFFFFF',
          line:    '#E5E8EE',
          dark:    '#1C1C28',
          muted:   '#7A7F9A',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        numeric: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
