import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      'sm': '375px',
      'md': '768px',
      'lg': '1440px',
    },
    colors: {
      'headerBackground': '#F5F7FC',
      'primaryColor': '#5EA8F5',
    },
    spacing: {
      px: '1px',
      0: '0',
      12: '12px',
      18: '18px',
      20: '20px',
      30: '30px',
      32: '32px'
    },
    opacity: {
      '0': '0',
      '20': '0.2',
      '40': '0.4',
      '60': '0.6',
      '80': '0.8',
      '100': '1',
    },
    extend: {
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
export default config
