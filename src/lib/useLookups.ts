import { useQuery } from '@tanstack/react-query';
import { lookupsApi, vendorsApi } from '@/api/endpoints';

/**
 * The shared reference data the create forms fill their dropdowns from. Cached for the
 * session — departments and categories change rarely, so re-fetching per dialog open would
 * be waste.
 */
export function useLookups(enabled = true) {
  return useQuery({
    queryKey: ['lookups'],
    queryFn: () => lookupsApi.get(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Active vendors, for the vendor picker on a contract or work order. */
export function useActiveVendors(enabled = true) {
  return useQuery({
    queryKey: ['vendors', 'active-lookup'],
    queryFn: () => vendorsApi.list({ status: 'Active', pageSize: 200, sortBy: 'legalName' }),
    enabled,
    staleTime: 60 * 1000,
  });
}
