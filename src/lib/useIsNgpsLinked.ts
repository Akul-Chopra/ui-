import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '@/api/endpoints';
import { useAuth } from '@/lib/useAuth';

/**
 * Whether the signed-in officer is linked to an NGPS user (has an NGPS User Key). Only linked
 * officers see "Process Payment Order" (the NGPS sign-on). Asked of the server once per session; vendors are never linked.
 * The sign-in endpoint refuses unlinked users anyway, so this only decides what is shown.
 */
export function useIsNgpsLinked(): boolean {
  const { isVendor } = useAuth();

  const link = useQuery({
    queryKey: ['ngps-link'],
    queryFn: paymentsApi.ngpsLink,
    enabled: !isVendor,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return !isVendor && link.data?.isLinked === true;
}
