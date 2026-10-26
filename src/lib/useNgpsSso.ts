import { useMutation } from '@tanstack/react-query';
import { paymentsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

/**
 * Signs the officer in to NGPS (single sign-on) and leaves VPS for it straight away.
 * The server mints a fresh NGPS token with the officer's own NGPS User Key on every
 * call; the portal keys never reach the browser, only the resulting sign-in URL.
 * A failure stays in VPS and is shown as a toast.
 */
export function useNgpsSso() {
  const dispatch = useAppDispatch();
  const sso = useMutation({
    mutationFn: paymentsApi.ngpsSso,
    onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl),
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  return {
    // Busy only while the sign-in URL is being fetched. Not after success: if the browser later
    // restores this page from its back/forward cache (Back from NGPS), the control must be usable.
    busy: sso.isPending,
    start: () => {
      if (!sso.isPending) sso.mutate();
    },
  };
}
