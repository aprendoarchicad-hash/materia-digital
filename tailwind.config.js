/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F8F7F4',
        ink: '#1D1818',
        accent: '#000000',
        'ink-faint': 'rgba(29, 24, 24, 0.1)',
      },
      fontFamily: {
        sans: ['Space Mono', 'monospace'],
        mono: ['Space Mono', 'monospace'],
        display: ['Oswald', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
