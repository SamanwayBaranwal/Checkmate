import type { Config } from 'tailwindcss';

// Design tokens live as CSS variables in globals.css (RGB triplets so Tailwind opacity modifiers work,
// e.g. bg-accent/10). Clean premium dark: charcoal surfaces, one warm accent, no neon, no glow.
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: rgb('--c-base'),
        surface: rgb('--c-surface'),
        'surface-2': rgb('--c-surface-2'),
        'surface-3': rgb('--c-surface-3'),
        line: rgb('--c-line'),
        ink: rgb('--c-ink'),
        muted: rgb('--c-muted'),
        faint: rgb('--c-faint'),
        accent: rgb('--c-accent'),
        brand: rgb('--c-brand'),
        'accent-ink': rgb('--c-accent-ink'),
        positive: rgb('--c-positive'),
        negative: rgb('--c-negative'),
        board: { light: '#ECE3D0', dark: '#A38867' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '18px' },
      boxShadow: {
        card: '0 1px 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px rgb(0 0 0 / 0.25)',
        pop: '0 20px 60px rgb(0 0 0 / 0.5)',
      },
    },
  },
  plugins: [],
};

export default config;
