import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ThemeMode } from '@/theme/theme';

interface UiState {
  themeMode: ThemeMode;
  sidebarOpen: boolean;
  toast: { message: string; severity: 'success' | 'error' | 'info' | 'warning' } | null;
}

const THEME_KEY = 'vps.theme';

const initialState: UiState = {
  // The theme preference persists across sessions — a user who works in dark mode should
  // not have to reset it every sign-in.
  themeMode: (localStorage.getItem(THEME_KEY) as ThemeMode) || 'light',
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

export const { toggleTheme, toggleSidebar, setSidebar, showToast, dismissToast } = uiSlice.actions;
export default uiSlice.reducer;
