import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
} from '@mui/material';
import { EventBusy } from '@mui/icons-material';
import { delegationsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { date } from '@/lib/format';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

const todayStr = () => new Date().toISOString().slice(0, 10);
const inTwoWeeks = () => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
};

/** Out-of-office self-service: shows the signed-in user's delegation and lets them set or end it. */
export function DelegationPanel() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const delegation = useQuery({ queryKey: ['my-delegation'], queryFn: delegationsApi.mine });

  const end = useMutation({
    mutationFn: () => delegationsApi.end(),
    onSuccess: () => {
      dispatch(showToast({ message: 'Delegation ended.', severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['my-delegation'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const d = delegation.data;

  return (
    <>
      {d ? (
        <Alert
          severity="info"
          icon={<EventBusy />}
          action={
            <Button color="inherit" size="small" disabled={end.isPending} onClick={() => end.mutate()}>
              End
            </Button>
          }
        >
          Your approvals are delegated to <strong>{d.delegateName}</strong> until {date(d.toDate)}.
        </Alert>
      ) : (
        <Button variant="outlined" startIcon={<EventBusy />} onClick={() => setOpen(true)}>
          Set out-of-office delegate
        </Button>
      )}

      {open && <DelegationDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function DelegationDialog({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [delegateUserId, setDelegateUserId] = useState('');
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(inTwoWeeks());
  const [reason, setReason] = useState('');

  // Only colleagues sharing the user's role(s) can act on their tasks — so only they qualify.
  const users = useQuery({ queryKey: ['delegate-candidates'], queryFn: delegationsApi.candidates });
  const distinct = Array.from(new Map((users.data ?? []).map((u) => [u.id, u])).values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );

  const save = useMutation({
    mutationFn: () =>
      delegationsApi.set({
        delegateUserId,
        fromDate: new Date(fromDate).toISOString(),
        toDate: new Date(toDate).toISOString(),
        reason: reason || undefined,
      }),
    onSuccess: () => {
      dispatch(showToast({ message: 'Delegation set — your pending tasks moved to the delegate.', severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['my-delegation'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const valid = !!delegateUserId && toDate > fromDate;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Out-of-office delegation</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            select
            label="Delegate my approvals to"
            value={delegateUserId}
            onChange={(e) => setDelegateUserId(e.target.value)}
            fullWidth
            required
          >
            {distinct.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.fullName}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              label="From"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Until"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
          />
          <Alert severity="info">
            Your current pending approvals move to the delegate now, and new ones route to them
            until the end date.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Set delegation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
