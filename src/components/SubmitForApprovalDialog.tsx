import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography } from '@mui/material';
import { ApprovalRoutingPicker, type RoutingChoice } from '@/components/ApprovalRoutingPicker';
import type { SubmitOptions, SubmitResult } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

/**
 * Submits a drafted contract or work order for approval, letting the officer choose the
 * routing (Automatic by role, or Manual to a chosen first approver) at the moment of submit.
 */
export function SubmitForApprovalDialog({
  open,
  onClose,
  reference,
  documentLabel,
  submitFn,
  invalidateKey,
}: {
  open: boolean;
  onClose: () => void;
  reference: string;
  documentLabel: string;
  submitFn: (body: SubmitOptions) => Promise<SubmitResult>;
  invalidateKey: unknown[];
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [routingMode, setRoutingMode] = useState<RoutingChoice>('Default');
  const [firstApproverId, setFirstApproverId] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      submitFn({
        routingMode: routingMode === 'Default' ? undefined : routingMode,
        firstApproverUserId: routingMode === 'Manual' ? firstApproverId : undefined,
      }),
    onSuccess: (result) => {
      const message = result.pendingWith
        ? `${reference} submitted for approval to ${result.pendingWith}.`
        : `${reference} submitted for approval.`;
      dispatch(showToast({ message, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      // The routing picker's Select renders its dropdown in a portal straight onto
      // document.body, but a click inside it still bubbles up through the React tree
      // (not the DOM tree) — through this Dialog and out into whatever row/card it was
      // opened from. Stopped here so a table row's own onClick (e.g. "open this
      // document") never fires just because the user picked a routing option.
      onClick={(e) => e.stopPropagation()}
    >
      <DialogTitle>Submit {reference} for approval</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Choose how this {documentLabel} is routed for approval.
          </Typography>
          <ApprovalRoutingPicker
            open={open}
            routingMode={routingMode}
            onRoutingModeChange={setRoutingMode}
            firstApproverId={firstApproverId}
            onFirstApproverChange={setFirstApproverId}
            documentLabel={documentLabel}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={mutation.isPending || (routingMode === 'Manual' && !firstApproverId)}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Submitting…' : 'Submit for approval'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
