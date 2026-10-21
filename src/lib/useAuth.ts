import { useAppSelector } from '@/store';
import { RoleCodes } from './permissions';

/** Convenience accessors over the auth slice, including the permission and role checks. */
export function useAuth() {
  const user = useAppSelector((s) => s.auth.user);
  const initialised = useAppSelector((s) => s.auth.initialised);

  const permissions = user?.permissions ?? [];
  const roles = user?.roles ?? [];

  return {
    user,
    initialised,
    isAuthenticated: !!user,
    isVendor: !!user?.vendorId,
    isPlatformAdmin: roles.includes(RoleCodes.SuperAdmin),
    /** True when the user holds the permission, or any of several alternatives. */
    can: (...codes: string[]) => codes.some((c) => permissions.includes(c)),
    isInRole: (code: string) => roles.includes(code),
  };
}
