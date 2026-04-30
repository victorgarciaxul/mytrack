/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cu: {
          purple:   '#7B68EE',
          violet:   '#6B4EFF',
          dark:     '#1A1A2E',
          darker:   '#13131F',
          sidebar:  '#16162A',
          muted:    '#2D2D4A',
          border:   '#2E2E4A',
          text:     '#A0A0C0',
          accent:   '#FF6BCA',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        numeric: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-cu': 'linear-gradient(135deg, #7B68EE 0%, #6B4EFF 100%)',
        'gradient-cu-soft': 'linear-gradient(135deg, #7B68EE22 0%, #6B4EFF22 100%)',
      },
      boxShadow: {
        'cu': '0 4px 24px rgba(107, 78, 255, 0.25)',
        'cu-sm': '0 2px 12px rgba(107, 78, 255, 0.15)',
      },
    },
  },
  plugins: [],
}

