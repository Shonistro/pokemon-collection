/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark theme palette inspired by the reference UI (near-black + teal accent)
        bg: {
          DEFAULT: '#000000',
          surface: '#0b0f0e',
          card: '#111615',
          elevated: '#161b1a',
        },
        accent: {
          DEFAULT: '#2dd4bf', // teal-400
          soft: '#14b8a6',
          dim: '#0f766e',
        },
        up: '#34d399', // green for gains
        down: '#f87171', // red for losses
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
