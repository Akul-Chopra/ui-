import { ToggleButton, Tooltip } from '@mui/material';
import { AssignmentInd } from '@mui/icons-material';

/**
 * A "Pending with me" filter toggle for the Contracts / Work Orders / Invoices lists.
 * Off (default) the list shows everything, so anyone can track any document; on, it
 * narrows to items with an approval step currently sitting in the signed-in user's queue.
 */
export function PendingWithMeToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Tooltip title="Show only items waiting for my action">
      <ToggleButton
        value="pending"
        size="small"
        selected={value}
        onChange={() => onChange(!value)}
        color="primary"
        sx={{ textTransform: 'none', whiteSpace: 'nowrap', px: 1.5 }}
      >
        <AssignmentInd fontSize="small" sx={{ mr: 0.75 }} />
        Pending with me
      </ToggleButton>
    </Tooltip>
  );
}
