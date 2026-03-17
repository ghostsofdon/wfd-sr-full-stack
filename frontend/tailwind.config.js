/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        risk: {
          high: { DEFAULT: '#ef4444', bg: '#fef2f2', text: '#991b1b' },
          medium: { DEFAULT: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
          low: { DEFAULT: '#10b981', bg: '#ecfdf5', text: '#065f46' },
        },
      },
    },
  },
  plugins: [],
};
