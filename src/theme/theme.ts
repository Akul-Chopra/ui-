import { createTheme, alpha, type Theme } from '@mui/material/styles';

export type ThemeMode = 'light' | 'dark';

/**
 * UX4G (User Experience for Government) design tokens — the Government of India design system
 * by NeGD/MeitY. UX4G's Webcore is Bootstrap-derived, so these are its canonical values.
 * https://doc.ux4g.gov.in — palette, native font stack, 16px base, ~6px radius, WCAG 2.1 AA.
 */
const UX4G = {
  primary: '#0d6efd',
  secondary: '#6c757d',
  success: '#198754',
  danger: '#dc3545',
  warningBadge: '#ffc107', // UX4G's bright warning — used as a badge/border fill
  warningText: '#997404', // accessible amber for warning-coloured text (WCAG 1.4.3)
  info: '#0dcaf0',
  // Grey scale (gray-100 … gray-900)
  g100: '#f8f9fa',
  g200: '#e9ecef',
  g300: '#dee2e6',
  g400: '#ced4da',
  g600: '#6c757d',
  g700: '#495057',
  g800: '#343a40',
  g900: '#212529',
  // Native font stack, as UX4G/Bootstrap specify.
  font:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif',
} as const;

/**
 * Builds the MUI theme for a mode from the UX4G design tokens, tinted by the tenant's brand
 * colour. UX4G supports per-department theme customisation, so each ministry keeps its brand
 * primary while every component still follows the UX4G component patterns; a tenant with no
 * brand colour falls back to the canonical UX4G blue.
 */
export function buildTheme(mode: ThemeMode, brandPrimary?: string, brandSecondary?: string): Theme {
  const isDark = mode === 'dark';
  const primary = brandPrimary || (isDark ? '#6ea8fe' : UX4G.primary);
  const secondary = brandSecondary || UX4G.secondary;

  return createTheme({
    palette: {
      mode,
      primary: { main: primary },
      secondary: { main: secondary },
      background: {
        default: isDark ? '#1a1d21' : UX4G.g100,
        paper: isDark ? '#212529' : '#ffffff',
      },
      // WCAG 2.1 AA text contrast (1.4.3): near-black body text on light, off-white on dark.
      text: isDark
        ? { primary: '#f8f9fa', secondary: '#adb5bd' }
        : { primary: UX4G.g900, secondary: UX4G.g700 },
      divider: isDark ? 'rgba(255,255,255,0.12)' : UX4G.g300,
      success: { main: isDark ? '#75b798' : UX4G.success },
      // Bright #ffc107 fails contrast as text; use an accessible amber for `.main` and keep the
      // bright badge tone available as `.light`.
      warning: { main: isDark ? '#ffda6a' : UX4G.warningText, light: UX4G.warningBadge },
      error: { main: isDark ? '#ea868f' : UX4G.danger },
      info: { main: isDark ? '#6edff6' : '#0a94b8' },
    },
    // UX4G/Bootstrap default border-radius (0.375rem ≈ 6px).
    shape: { borderRadius: 6 },
    typography: {
      fontFamily: UX4G.font,
      // UX4G/Bootstrap heading weights (500) and non-shouty buttons.
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { colorScheme: mode },
          body: { lineHeight: 1.5 },
          // Visible keyboard focus on every interactive element (WCAG 2.4.7 / 2.4.11).
          '*:focus-visible': {
            outline: `3px solid ${isDark ? '#9ec5fe' : primary}`,
            outlineOffset: '2px',
            borderRadius: '4px',
          },
          // Honour reduced-motion preferences (WCAG 2.3.3).
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.01ms !important',
              scrollBehavior: 'auto !important',
            },
          },
        },
      },
      MuiButton: {
        // Solid, no-shadow UX4G buttons; 40px min target (WCAG 2.5.5 / 2.5.8).
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: 40, borderRadius: 6, paddingInline: 16, fontWeight: 600 },
          containedPrimary: { '&:hover': { backgroundColor: isDark ? primary : '#0b5ed7' } },
          outlined: { borderWidth: 1 },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { minWidth: 40, minHeight: 40, borderRadius: 6 } },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : UX4G.g300}`,
          },
          // UX4G cards: 0.5rem radius with a soft shadow.
          elevation1: { boxShadow: '0 .125rem .25rem rgba(0,0,0,.075)' },
        },
      },
      MuiCard: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiChip: {
        // UX4G/Bootstrap badge: compact, semibold, gently rounded.
        styleOverrides: { root: { fontWeight: 600, borderRadius: 6 }, sizeSmall: { height: 22 } },
      },
      MuiOutlinedInput: {
        // Bootstrap form control: grey border, primary focus ring.
        styleOverrides: {
          root: {
            borderRadius: 6,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? 'rgba(255,255,255,0.2)' : UX4G.g400 },
            '&.Mui-focused': { boxShadow: `0 0 0 0.25rem ${alpha(primary, 0.25)}` },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: primary, borderWidth: 1 },
          },
        },
      },
      MuiAppBar: {
        // UX4G top bar: solid surface with a hairline underline, not a coloured bar.
        defaultProps: { color: 'default', elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#212529' : '#ffffff',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : UX4G.g300}`,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: { root: { '& .MuiTableCell-head': { backgroundColor: isDark ? '#2b3035' : UX4G.g100, fontWeight: 600 } } },
      },
      MuiTableCell: {
        styleOverrides: { root: { borderColor: isDark ? 'rgba(255,255,255,0.10)' : UX4G.g200 } },
      },
      MuiAlert: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } } },
      MuiLink: { defaultProps: { underline: 'hover' }, styleOverrides: { root: { fontWeight: 600 } } },
    },
  });
}

/**
 * Page-level CSS variables the plain-CSS rules in index.css and the public pages' backdrops
 * consume. The NGPS look supplies its own (ngpsCssVars); these are the VPS look's values.
 */
export function themeCssVars(mode: ThemeMode): Record<string, string> {
  const backdrops = {
    // Sign-in and registration backdrop.
    '--vps-auth-bg':
      'radial-gradient(1200px 600px at 10% -10%, rgba(11,79,108,0.25), transparent), radial-gradient(1000px 500px at 110% 110%, rgba(1,186,239,0.2), transparent)',
    // Landing page hero.
    '--vps-home-hero-bg':
      'radial-gradient(1200px 600px at 10% -10%, rgba(11,79,108,0.22), transparent), radial-gradient(1000px 500px at 110% 10%, rgba(1,186,239,0.18), transparent)',
  };
  return mode === 'dark'
    ? { '--vps-page-bg': '#1a1d21', '--vps-scrollbar': 'rgba(173,181,189,0.35)', ...backdrops }
    : { '--vps-page-bg': '#f8f9fa', '--vps-scrollbar': 'rgba(33,37,41,0.2)', ...backdrops };
}

/**
 * Maps the backend's semantic "tone" (neutral/info/warning/success/danger) onto a MUI
 * chip colour. The server decides the tone once per status; the client only renders it,
 * so a status never has two different colours in two different screens.
 */
export function toneToChipColor(
  tone: string
): 'default' | 'info' | 'warning' | 'success' | 'error' {
  switch (tone) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'error';
    case 'info':
      return 'info';
    default:
      return 'default';
  }
}
