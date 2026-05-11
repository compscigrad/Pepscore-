import type { Config } from 'tailwindcss'

// Pepscore brand tokens — gold/black/white luxury palette from original site
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './emails/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#C49A1A',
          dark: '#9E7C15',
          light: '#E8C84A',
        },
        cream: {
          DEFAULT: '#FAFAF5',
          dark: '#F0EDE4',
        },
        dark: '#1A1A1A',
        g700: '#424242',
        g500: '#757575',
        g300: '#BDBDBD',
        g100: '#F5F5F0',
      },
      fontFamily: {
        heading: ['Montserrat', 'sans-serif'],
        body: ['Libre Franklin', 'sans-serif'],
      },
      boxShadow: {
        sh: '0 1px 3px rgba(0,0,0,.08)',
        sm2: '0 4px 16px rgba(0,0,0,.10)',
        sl: '0 8px 32px rgba(0,0,0,.12)',
        gold: '0 4px 20px rgba(196,154,26,.25)',
      },
      borderRadius: {
        card: '16px',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
