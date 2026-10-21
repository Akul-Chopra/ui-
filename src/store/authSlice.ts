import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthResponse, SignedInUser } from '@/api/types';
import { clearSession, loadSession, saveSession } from '@/api/client';
import { RoleCodes } from '@/lib/permissions';

interface AuthState {
  user: SignedInUser | null;
  /** True once the initial session-from-storage check has run, so guards don't flash. */
  initialised: boolean;
  /** Tenant a platform admin is currently acting inside, if they have switched. */
  actingTenantId: string | null;
}

const PROFILE_KEY = 'vps.profile';

// The profile is cached in localStorage alongside the token so a page refresh or a
// pasted deep link restores the session rather than bouncing to sign-in. It carries only
// what the signed token already encodes (tenant, roles, permissions), and it is discarded
// the moment the token is cleared — the profile can never outlive its token.
function loadProfile(): SignedInUser | null {
  if (!loadSession()) return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  return raw ? (JSON.parse(raw) as SignedInUser) : null;
}

const initialState: AuthState = {
  user: loadProfile(),
  initialised: false,
  actingTenantId: loadSession()?.actingTenantId ?? null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<AuthResponse>) {
      const { accessToken, refreshToken, user } = action.payload;
      state.user = user;
      state.initialised = true;
      const isPlatformAdmin = user.roles.includes(RoleCodes.SuperAdmin);
      saveSession({
        accessToken,
        refreshToken,
        tenantId: user.tenant.id,
        isPlatformAdmin,
        actingTenantId: state.actingTenantId ?? undefined,
      });
      localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
    },
    // Marks the startup session check complete when there is nothing to restore. The
    // access token alone cannot rebuild the profile, so a page refresh returns to sign-in;
    // this keeps the demo honest rather than faking a restored session.
    startupChecked(state) {
      state.initialised = true;
    },
    signedOut(state) {
      state.user = null;
      state.actingTenantId = null;
      clearSession();
      localStorage.removeItem(PROFILE_KEY);
    },
    tenantSwitched(state, action: PayloadAction<string | null>) {
      state.actingTenantId = action.payload;
      const session = loadSession();
      if (session) {
        saveSession({ ...session, actingTenantId: action.payload ?? undefined });
      }
    },
  },
});

export const { signedIn, startupChecked, signedOut, tenantSwitched } = authSlice.actions;
export default authSlice.reducer;
