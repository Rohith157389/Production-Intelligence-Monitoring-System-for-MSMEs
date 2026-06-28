/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        factory: {
          bg: '#0F172A',
          card: '#1E293B',
          border: '#334155',
          accent: '#06B6D4',
          healthy: '#22C55E',
          warn: '#F59E0B',
          critical: '#EF4444',
        },
      },
    },
  },
  plugins: [],
};
