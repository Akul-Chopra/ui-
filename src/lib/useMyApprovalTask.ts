import { useQuery } from '@tanstack/react-query';
import { approvalsApi } from '@/api/endpoints';
import type { ApprovalTask } from '@/api/types';

/**
 * The signed-in user's own pending approval task for one document, if any — lets a Contract
 * or Work Order's detail page offer inline Approve/Reject/Return the moment it's genuinely
 * pending with the viewer, without duplicating the ownership logic the Approvals inbox
 * already enforces server-side (this is a convenience lookup, not a new authorisation path).
 */
export function useMyTask(entityId: string | null, enabled: boolean): ApprovalTask | null {
  const { data } = useQuery({
    queryKey: ['approvals', 'mine-for-detail'],
    queryFn: () => approvalsApi.mine(),
    enabled: enabled && !!entityId,
  });

  return (data ?? []).find((t) => t.entityId === entityId) ?? null;
}
