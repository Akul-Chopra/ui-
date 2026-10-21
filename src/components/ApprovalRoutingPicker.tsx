import { useQuery } from '@tanstack/react-query';
import { TextField, MenuItem, Box, Typography, Stack } from '@mui/material';
import { approvalsApi } from '@/api/endpoints';

/**
 * Chooses how a contract / work order is routed for approval on submit: Automatic (approvers
 * resolved from each step's role, the default) or Manual (the initiator picks the officer it
 * goes to first — and, because routing stays Manual for the document's whole life, every
 * approver after them is asked to pick the next officer too, all the way to the final level).
 */
export type RoutingChoice = 'Default' | 'Auto' | 'Manual';

export function ApprovalRoutingPicker({
  open,
  routingMode,
  onRoutingModeChange,
  firstApproverId,
  onFirstApproverChange,
  documentLabel = 'document',
}: {
  open: boolean;
  routingMode: RoutingChoice;
  onRoutingModeChange: (m: RoutingChoice) => void;
  firstApproverId: string;
  onFirstApproverChange: (id: string) => void;
  documentLabel?: string;
}) {
  const officers = useQuery({ queryKey: ['officers'], queryFn: () => approvalsApi.officers(), enabled: open });

  return (
    <Box sx={{ p: 1.75, borderRadius: 1.5, border: (t) => `1px solid ${t.palette.divider}` }}>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.25 }}>
        Approval routing
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          select
          label="Routing"
          size="small"
          value={routingMode}
          onChange={(e) => onRoutingModeChange(e.target.value as RoutingChoice)}
          onKeyDown={(e) => {
            // The Select's own dropdown closes on Escape; without stopping it here, that
            // keydown bubbles past the Select into the parent Dialog's Escape handler too,
            // closing the whole Submit dialog along with it.
            if (e.key === 'Escape') e.stopPropagation();
          }}
          sx={{ minWidth: 230 }}
          helperText={
            routingMode === 'Manual'
              ? 'Every approver, including you now, picks who it goes to next'
              : routingMode === 'Auto'
                ? 'Approvers resolved by role'
                : "Uses this workflow's configured routing"
          }
        >
          <MenuItem value="Default">Workflow default</MenuItem>
          <MenuItem value="Auto">Automatic (by role)</MenuItem>
          <MenuItem value="Manual">Manual (choose the officer at every level)</MenuItem>
        </TextField>
        {routingMode === 'Manual' && (
          <TextField
            select
            label="Send first to"
            size="small"
            required
            value={firstApproverId}
            onChange={(e) => onFirstApproverChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') e.stopPropagation();
            }}
            sx={{ flex: 1, minWidth: 240 }}
            helperText={`The officer who receives this ${documentLabel} for the first approval`}
          >
            {(officers.data ?? []).map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.fullName}
                {o.designation ? ` · ${o.designation}` : ''}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>
    </Box>
  );
}
