/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ecoa: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#b8ccff',
          500: '#4f73cc',
          600: '#3a5ab8',
          700: '#2d4799',
          800: '#1e3070',
          900: '#0f1a42',
        },
      },
    },
  },
  plugins: [],
}
