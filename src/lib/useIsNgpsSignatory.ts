import { useQuery } from '@tanstack/react-query';
import { ngpsSanctionOrdersApi } from '@/api/endpoints';
import { Permissions } from '@/lib/permissions';
import { useAuth } from '@/lib/useAuth';

/**
 * Whether the signed-in user is an NGPS signatory (their linked NGPS user is a Maker or
 * Checker). Only signatories see the Sanction Order section. Asked of the server once per
 * session for users who hold the Sanction Order permission; the server enforces the same rule
 * on every Sanction Order request, so this only decides what the menu shows.
 */
export function useIsNgpsSignatory(): boolean {
  const { can, isVendor } = useAuth();
  const eligible = !isVendor && can(Permissions.paymentNgpsPrepare);

  const setup = useQuery({
    queryKey: ['ngps-sanction-setup'],
    queryFn: ngpsSanctionOrdersApi.setup,
    enabled: eligible,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return eligible && setup.data?.isSignatory === true;
}
