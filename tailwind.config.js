/** @type {import('tailwindcss').Config} */
// Design tokens: stitch-export/design-system/industrial-clarity-light.md (primary = #0058be).
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0058be',
          hover: '#004a9e',
          container: '#2170e4',
          wash: '#eff4ff',
        },
        // Semantic (CLAUDE.md §17)
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#0058be',
        // Surfaces & text (Industrial Clarity)
        background: '#f8f9fb',
        surface: '#ffffff',
        'surface-muted': '#f1f3ff',
        ink: '#111827',
        'ink-soft': '#6b7280',
        line: '#e5e7eb',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        control: '14px',
        input: '14px',
      },
      boxShadow: {
        card: '0 4px 20px rgba(0,0,0,0.03)',
        'card-hover': '0 12px 32px rgba(0,0,0,0.08)',
      },
      spacing: {
        header: '72px',
      },
    },
  },
  plugins: [],
};
