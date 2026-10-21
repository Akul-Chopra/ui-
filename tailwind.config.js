/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind is used for layout and spacing utilities; MUI owns components and theming.
  // 'important' is scoped so Tailwind utilities can override MUI's emotion styles when
  // the two meet, without a global !important that would leak into MUI internals.
  important: '#vps-root',
  corePlugins: {
    // MUI already ships a CSS reset (CssBaseline); Tailwind's preflight would fight it.
    preflight: false,
  },
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
