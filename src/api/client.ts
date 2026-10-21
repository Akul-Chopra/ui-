import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthResponse, ProblemDetails } from './types';

// In development Vite proxies /api to the backend, so an empty base is same-origin. A
// production build points at the deployed API via VITE_API_BASE_URL.
const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

const STORAGE_KEY = 'vps.session';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  isPlatformAdmin: boolean;
  actingTenantId?: string;
}

export function loadSession(): StoredSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as StoredSession) : null;
}

export function saveSession(session: StoredSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the bearer token, and — for a platform admin who has switched tenant — the
// tenant override header the backend honours only for that role.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const session = loadSession();
  if (session?.accessToken) {
    config.headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  if (session?.isPlatformAdmin && session.actingTenantId) {
    config.headers.set('X-Tenant-Id', session.actingTenantId);
  }
  return config;
});

// A single in-flight refresh shared by every request that 401s at once, so a burst of
// parallel calls after an expiry triggers exactly one refresh rather than a stampede.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const session = loadSession();
  if (!session?.refreshToken) return null;

  try {
    const { data } = await axios.post<AuthResponse>(`${baseURL}/api/v1/auth/refresh`, {
      refreshToken: session.refreshToken,
    });
    saveSession({
      ...session,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    return data.accessToken;
  } catch {
    // The refresh token is spent or revoked; the session is over.
    clearSession();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ProblemDetails>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    // Attempt one silent refresh on a 401, unless this is already the retry or the refresh
    // endpoint itself. The refresh endpoint may not exist yet server-side; a failed
    // refresh simply falls through to the session ending, which is the correct outcome.
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
      const token = await refreshInFlight;
      if (token) {
        original.headers.set('Authorization', `Bearer ${token}`);
        return api(original);
      }
      // Refresh failed — bounce to sign-in, preserving where the user was.
      if (!location.pathname.startsWith('/login')) {
        location.assign('/login');
      }
    }

    return Promise.reject(error);
  }
);

/** Extracts a human message from a problem-details error for toasts and form errors. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const problem = error.response?.data as ProblemDetails | undefined;
    if (problem?.errors) {
      const first = Object.values(problem.errors)[0];
      if (first?.length) return first[0];
    }
    if (problem?.detail) return problem.detail;
    if (problem?.title) return problem.title;
    return error.message;
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
