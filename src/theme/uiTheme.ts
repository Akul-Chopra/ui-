import type { UiThemeMode, UiThemeSettings } from '@/api/types';

/**
 * Mode B (NGPS-inspired) design tokens. The defaults are the values in NGPS's own stylesheet
 * (NGPSPortal/Resources/assets/css/ngps-ux4g.css) and match the rows seeded by V073, so the
 * database only needs a row to change one.
 */
export interface NgpsTokens {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentDeep: string;
  sidebar: string;
  pageBg: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  fontFamily: string;
  radius: number;
}

export const NGPS_DEFAULT_TOKENS: NgpsTokens = {
  primary: '#003087',
  primaryDark: '#00236A',
  primaryLight: '#1B5CB5',
  accent: '#E86D1F',
  accentDeep: '#C2560F',
  sidebar: '#0B2259',
  pageBg: '#F4F7FB',
  text: '#0D1E3D',
  textSecondary: '#4A5568',
  border: '#D5E0F0',
  success: '#1A7A3C',
  warning: '#B45309',
  danger: '#C0392B',
  fontFamily: "'Noto Sans', 'Segoe UI', Arial, sans-serif",
  radius: 8,
};

/** The active look on the client: the mode plus fully-resolved Mode B tokens. */
export interface ActiveUiTheme {
  mode: UiThemeMode;
  ngps: NgpsTokens;
}

export const DEFAULT_UI_THEME: ActiveUiTheme = { mode: 'VPS', ngps: NGPS_DEFAULT_TOKENS };

const HEX = /^#[0-9A-Fa-f]{6}$/;
const FONT = /^[A-Za-z0-9 ,'"-]{1,200}$/;

const COLOUR_KEYS = [
  'primary', 'primaryDark', 'primaryLight', 'accent', 'accentDeep', 'sidebar', 'pageBg',
  'text', 'textSecondary', 'border', 'success', 'warning', 'danger',
] as const;

/**
 * Resolves the API's settings into an active theme. Every value is re-checked here as well as
 * on the server: an unknown mode means VPS and a bad token keeps its default, so nothing the
 * API or a stale cache returns can break the look.
 */
export function resolveUiTheme(settings: Partial<UiThemeSettings> | null | undefined): ActiveUiTheme {
  if (!settings || typeof settings !== 'object') return DEFAULT_UI_THEME;

  const mode: UiThemeMode = String(settings.mode ?? '').toUpperCase() === 'NGPS' ? 'NGPS' : 'VPS';
  const tokens = settings.tokens && typeof settings.tokens === 'object' ? settings.tokens : {};
  const ngps: NgpsTokens = { ...NGPS_DEFAULT_TOKENS };

  for (const key of COLOUR_KEYS) {
    const value = tokens[`ngps.color.${key}`];
    if (typeof value === 'string' && HEX.test(value)) ngps[key] = value;
  }
  const font = tokens['ngps.font.family'];
  if (typeof font === 'string' && FONT.test(font)) ngps.fontFamily = font;
  const radius = Number(tokens['ngps.radius']);
  if (Number.isInteger(radius) && radius >= 0 && radius <= 16) ngps.radius = radius;

  return { mode, ngps };
}

const CACHE_KEY = 'vps.uiTheme';

/**
 * The last settings the API returned, so a refresh paints the right look at once instead of
 * flashing the other one while the request is in flight. Null on a first visit.
 */
export function readCachedUiTheme(): ActiveUiTheme | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? resolveUiTheme(JSON.parse(raw) as UiThemeSettings) : null;
  } catch {
    return null;
  }
}

export function writeCachedUiTheme(settings: UiThemeSettings): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ mode: settings.mode, tokens: settings.tokens }));
  } catch {
    /* storage full or blocked: the look still applies for this page load */
  }
}
