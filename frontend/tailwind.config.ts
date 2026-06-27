import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        board: {
          light: '#f0d9b5',
          dark: '#b58863',
        },
        brand: {
          green: '#4caf50',
          gold: '#ffd700',
        },
      },
    },
  },
  plugins: [],
};

export default config;
