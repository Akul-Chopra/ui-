import { useQuery } from '@tanstack/react-query';
import { MenuItem, TextField } from '@mui/material';
import { usersApi } from '@/api/endpoints';

/**
 * A "Pending with" approver picker for the list screens: choosing a person narrows the list
 * to documents whose current approval step is pending with them. Empty means anyone.
 *
 * The options are only the officers who actually hold an open task for this document type —
 * vendors never appear, since approvals are given by officers, not by the vendor under review.
 */
export function PendingWithFilter({
  value,
  onChange,
  entityType,
}: {
  value: string;
  onChange: (userId: string) => void;
  /** Document type to scope approvers to: 0 Contract, 1 Work Order, 2 Invoice, 3 Payment. */
  entityType: number;
}) {
  const users = useQuery({
    queryKey: ['pending-approvers', entityType],
    queryFn: () => usersApi.pendingApprovers(entityType),
  });

  return (
    <TextField
      select
      size="small"
      label="Pending with"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ minWidth: 200 }}
    >
      <MenuItem value="">
        <em>Anyone</em>
      </MenuItem>
      {(users.data ?? []).map((u) => (
        <MenuItem key={u.id} value={u.id}>
          {u.fullName}
        </MenuItem>
      ))}
    </TextField>
  );
}
