import { createTheme, alpha, type Theme } from '@mui/material/styles';
import { buildTheme, type ThemeMode } from './theme';
import type { NgpsTokens } from './uiTheme';

/**
 * Mode B: an NGPS-inspired look, built from the NGPS portal's design language (navy + saffron,
 * Noto Sans, navy table heads, saffron-underlined header, left-bar alerts). It starts from the
 * UX4G theme so every accessibility rule there (focus rings, 40px targets, reduced motion)
 * carries over, then restyles the shared components — screens are never styled one by one.
 *
 * NGPS has no dark theme, so in dark mode Mode B keeps the VPS dark theme with NGPS typography.
 * The NGPS identity is the point of this mode, so the tenant brand colour is not applied.
 */
export function buildNgpsTheme(mode: ThemeMode, t: NgpsTokens): Theme {
  if (mode === 'dark') {
    return createTheme(buildTheme('dark'), { typography: fontEverywhere(t.fontFamily) });
  }

  const base = buildTheme('light', t.primary, t.accentDeep);
  const r = t.radius;
  const onNavy = '#ffffff';
  const onNavySoft = 'rgba(255,255,255,0.78)';
  const fieldBorder = '#B8CBDF';
  const band = '#EAF0FA';

  return createTheme(base, {
    palette: {
      primary: { main: t.primary, dark: t.primaryDark, light: t.primaryLight, contrastText: '#ffffff' },
      // Deep saffron: the NGPS shade that keeps white text at 4.5:1.
      secondary: { main: t.accentDeep, contrastText: '#ffffff' },
      background: { default: t.pageBg, paper: '#ffffff' },
      text: { primary: t.text, secondary: t.textSecondary },
      divider: t.border,
      success: { main: t.success },
      warning: { main: t.warning },
      error: { main: t.danger },
      info: { main: t.primaryLight },
    },
    shape: { borderRadius: r },
    typography: {
      ...fontEverywhere(t.fontFamily),
      h4: { fontFamily: t.fontFamily, fontWeight: 700 },
      h5: { fontFamily: t.fontFamily, fontWeight: 700 },
      h6: { fontFamily: t.fontFamily, fontWeight: 700 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // NGPS focus: a 3px saffron outline.
          '*:focus-visible': { outline: `3px solid ${t.accent}`, outlineOffset: '2px' },
          // Page title block (PageHeader): NGPS page-header band with a saffron left bar.
          '.vps-page-header': {
            background: '#EBF1FB',
            borderLeft: `4px solid ${t.accent}`,
            borderRadius: `0 ${r}px ${r}px 0`,
            padding: '10px 16px',
          },
          '.vps-sidebar-footer': { borderTop: `3px solid ${t.accent}`, background: '#002060' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            // Two classes, so this outranks the top bar's own sx border and surface.
            '&.MuiAppBar-positionFixed': {
              backgroundColor: t.primary,
              color: onNavy,
              borderBottom: `3px solid ${t.accent}`,
              backdropFilter: 'none',
            },
            '& .MuiTypography-root': { color: 'inherit' },
            '& .MuiTypography-caption': { color: onNavySoft },
            '& .MuiIconButton-root': { color: onNavy },
            '& .MuiSvgIcon-colorPrimary': { color: onNavy },
            '& .MuiAvatar-root': { backgroundColor: t.accentDeep, color: '#ffffff' },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          // The navigation sidebar (the only left drawer): NGPS dark-navy menu.
          paperAnchorLeft: {
            backgroundColor: t.sidebar,
            color: 'rgba(255,255,255,0.86)',
            borderRight: 'none',
            '& .MuiTypography-root': { color: 'inherit' },
            '& .MuiTypography-caption, & .MuiTypography-overline': { color: 'rgba(255,255,255,0.62)' },
            '& .MuiListItemIcon-root': { color: '#9DB3D6' },
            '& .MuiListItemButton-root': {
              borderLeft: '3px solid transparent',
              borderRadius: r,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)', color: '#ffffff' },
            },
            '& .MuiListItemButton-root.Mui-selected': {
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderLeftColor: t.accent,
              color: '#ffffff',
              fontWeight: 600,
              '& .MuiListItemIcon-root': { color: '#F7A35C' },
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.16)' },
            },
            '& .MuiListItemButton-root.Mui-disabled': { opacity: 0.5 },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 600, letterSpacing: '0.2px' },
          containedPrimary: { '&:hover': { backgroundColor: t.primaryDark } },
          outlined: { borderWidth: 1.5, '&:hover': { borderWidth: 1.5, backgroundColor: '#EBF0F9' } },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { border: `1px solid ${t.border}` },
          elevation1: { boxShadow: '0 2px 8px rgba(0,48,135,.10)' },
        },
      },
      MuiCard: {
        styleOverrides: { root: { borderRadius: r + 2, boxShadow: '0 2px 14px rgba(0,48,135,.08)' } },
      },
      MuiCardHeader: {
        // NGPS card-header: navy gradient with a saffron underline.
        styleOverrides: {
          root: {
            background: `linear-gradient(118deg, ${t.primary} 55%, ${t.primaryLight} 100%)`,
            borderBottom: `3px solid ${t.accent}`,
            color: '#ffffff',
            '& .MuiCardHeader-subheader': { color: onNavySoft },
          },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { color: '#2D4268', fontWeight: 500 } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: fieldBorder, borderWidth: 1.5 },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9FB1CC' },
            '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(t.primary, 0.14)}` },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: t.primary, borderWidth: 1.5 },
            '&.Mui-disabled': { backgroundColor: '#F1F5FB' },
            '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: t.danger },
          },
        },
      },
      MuiTableHead: {
        // NGPS data tables: navy header row with white text.
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              backgroundColor: t.primary,
              color: '#ffffff',
              fontWeight: 600,
              borderColor: t.primaryDark,
            },
            '& .MuiTableSortLabel-root, & .MuiTableSortLabel-root:hover, & .MuiTableSortLabel-root.Mui-active': {
              color: '#ffffff',
            },
            '& .MuiTableSortLabel-icon': { color: 'rgba(255,255,255,0.85) !important' },
            '& .MuiCheckbox-root': { color: '#ffffff' },
          },
        },
      },
      MuiTableBody: {
        styleOverrides: {
          root: {
            '& .MuiTableRow-root:nth-of-type(even)': { backgroundColor: t.pageBg },
            '& .MuiTableRow-root.MuiTableRow-hover:hover': { backgroundColor: band },
          },
        },
      },
      MuiTableCell: { styleOverrides: { root: { borderColor: t.border } } },
      MuiTablePagination: { styleOverrides: { root: { color: t.textSecondary } } },
      MuiPaginationItem: {
        styleOverrides: {
          root: {
            borderRadius: r,
            '&.Mui-selected': { backgroundColor: t.primary, color: '#ffffff', '&:hover': { backgroundColor: t.primaryDark } },
          },
        },
      },
      MuiAlert: {
        // NGPS alerts: tinted surface with a 4px left bar. Standard (inline) alerts only — the
        // filled toasts and outlined notes keep their own shape.
        styleOverrides: {
          root: { borderRadius: 6 },
          standardInfo: { backgroundColor: '#EBF5FB', color: '#1B3A72', borderLeft: `4px solid ${t.primaryLight}` },
          standardSuccess: { backgroundColor: '#EAF7EE', color: '#144D27', borderLeft: `4px solid ${t.success}` },
          standardWarning: { backgroundColor: '#FEF9E7', color: '#7D5A07', borderLeft: '4px solid #D4A017' },
          standardError: { backgroundColor: '#FDEDEB', color: '#7B241C', borderLeft: `4px solid ${t.danger}` },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 20, fontWeight: 700 } } },
      MuiDialog: {
        styleOverrides: {
          paper: { border: 0, borderRadius: 14, boxShadow: '0 24px 60px rgba(0,18,68,.28)' },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontWeight: 700, borderBottom: '1px solid #DCE4EF', marginBottom: 8 } },
      },
      MuiDialogActions: { styleOverrides: { root: { borderTop: '1px solid #DCE4EF' } } },
      MuiTabs: { styleOverrides: { indicator: { backgroundColor: t.accent, height: 3 } } },
      MuiTab: { styleOverrides: { root: { '&.Mui-selected': { color: t.primary } } } },
      MuiLink: { styleOverrides: { root: { color: t.primaryDark } } },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: t.text } } },
    },
  });
}

const TYPE_VARIANTS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'subtitle1', 'subtitle2', 'body1', 'body2', 'button', 'caption', 'overline',
] as const;

/** The base theme has already resolved a font per variant, so each one is set, not just the root. */
function fontEverywhere(fontFamily: string) {
  return {
    fontFamily,
    ...Object.fromEntries(TYPE_VARIANTS.map((v) => [v, { fontFamily }])),
  };
}

/** Mode B page-level CSS variables (see themeCssVars for Mode A). */
export function ngpsCssVars(mode: ThemeMode, t: NgpsTokens): Record<string, string> {
  if (mode === 'dark') {
    return {
      '--vps-page-bg': '#1a1d21',
      '--vps-scrollbar': 'rgba(173,181,189,0.35)',
      '--vps-auth-bg': '#1a1d21',
      '--vps-home-hero-bg': 'transparent',
    };
  }
  return {
    '--vps-page-bg': t.pageBg,
    '--vps-scrollbar': 'rgba(0,48,135,0.25)',
    // NGPS sign-in brand panel gradient, behind the white sign-in / registration card.
    '--vps-auth-bg': 'radial-gradient(70% 60% at 100% 0%, rgba(27,92,181,.5) 0%, transparent 70%), linear-gradient(150deg, #001244 0%, #00256F 60%, #003087 100%)',
    '--vps-home-hero-bg': `linear-gradient(180deg, #EAF0FA 0%, ${t.pageBg} 100%)`,
  };
}
