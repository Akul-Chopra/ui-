import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ThemeMode } from '@/theme/theme';
import type { UiThemeSettings } from '@/api/types';
import {
  DEFAULT_UI_THEME,
  readCachedUiTheme,
  resolveUiTheme,
  writeCachedUiTheme,
  type ActiveUiTheme,
} from '@/theme/uiTheme';

interface UiState {
  themeMode: ThemeMode;
  /** The application look (VPS or NGPS) the Super Admin chose for everyone. */
  uiTheme: ActiveUiTheme;
  /** True once the look is known — from the cache or the API — so the app can paint. */
  uiThemeKnown: boolean;
  sidebarOpen: boolean;
  toast: { message: string; severity: 'success' | 'error' | 'info' | 'warning' } | null;
}

const THEME_KEY = 'vps.theme';

const cachedUiTheme = readCachedUiTheme();

const initialState: UiState = {
  // The theme preference persists across sessions — a user who works in dark mode should
  // not have to reset it every sign-in.
  themeMode: (localStorage.getItem(THEME_KEY) as ThemeMode) || 'light',
  uiTheme: cachedUiTheme ?? DEFAULT_UI_THEME,
  uiThemeKnown: cachedUiTheme !== null,
  sidebarOpen: true,
  toast: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme(state) {
      state.themeMode = state.themeMode === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, state.themeMode);
    },
    /** Settings from the API: applied, and cached so the next load paints them at once. */
    uiThemeLoaded(state, action: PayloadAction<UiThemeSettings>) {
      state.uiTheme = resolveUiTheme(action.payload);
      state.uiThemeKnown = true;
      writeCachedUiTheme(action.payload);
    },
    /** The API could not be reached: keep the cached look, or the VPS default without one. */
    uiThemeUnavailable(state) {
      state.uiThemeKnown = true;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebar(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    showToast(state, action: PayloadAction<UiState['toast']>) {
      state.toast = action.payload;
    },
    dismissToast(state) {
      state.toast = null;
    },
  },
});

export const {
  toggleTheme,
  uiThemeLoaded,
  uiThemeUnavailable,
  toggleSidebar,
  setSidebar,
  showToast,
  dismissToast,
} = uiSlice.actions;
export default uiSlice.reducer;
