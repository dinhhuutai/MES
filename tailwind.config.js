/** @type {import('tailwindcss').Config} */
// Design tokens: stitch-export/design-system/industrial-clarity-light.md (primary = #0058be).
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        // Token nền/chữ/đường kẻ theo CSS variables → đổi được sáng/tối (xem index.css).
        primary: {
          DEFAULT: '#0058be',
          hover: '#004a9e',
          container: '#2170e4',
          wash: 'rgb(var(--c-primary-wash) / <alpha-value>)',
        },
        // Semantic (CLAUDE.md §17) — giữ cố định, đọc tốt trên cả 2 nền.
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#0058be',
        // Surfaces & text (Industrial Clarity) — theme-able.
        background: 'rgb(var(--c-background) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-muted': 'rgb(var(--c-surface-muted) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--c-ink-soft) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
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
      keyframes: {
        // Nhấp nháy mạnh: đổi nền + viền + scale + glow để dễ thấy ở xưởng.
        'blink-danger': {
          '0%, 100%': { backgroundColor: '#fee2e2', borderColor: '#fca5a5', boxShadow: '0 0 0 0 rgba(239,68,68,0)', transform: 'scale(1)' },
          '50%': { backgroundColor: '#ef4444', borderColor: '#b91c1c', boxShadow: '0 0 0 4px rgba(239,68,68,0.45)', transform: 'scale(1.03)' },
        },
        'blink-warning': {
          '0%, 100%': { backgroundColor: '#fef3c7', borderColor: '#fcd34d', boxShadow: '0 0 0 0 rgba(245,158,11,0)', transform: 'scale(1)' },
          '50%': { backgroundColor: '#f59e0b', borderColor: '#b45309', boxShadow: '0 0 0 4px rgba(245,158,11,0.4)', transform: 'scale(1.02)' },
        },
      },
      animation: {
        'blink-danger': 'blink-danger 0.7s ease-in-out infinite',
        'blink-warning': 'blink-warning 0.9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
