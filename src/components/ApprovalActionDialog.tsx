import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  MenuItem,
  Alert,
  Typography,
  Divider,
} from '@mui/material';
import { approvalsApi } from '@/api/endpoints';
import type { ApprovalTask } from '@/api/types';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

export type ActionKind = 'Approve' | 'Reject' | 'Return';

/**
 * The single dialog every Approve/Reject/Return decision goes through, whichever screen it
 * was opened from — the Approvals inbox, or the inline actions on a Contract/Work Order's own
 * detail page. Handles the two things a plain decision can additionally require: a manually-
 * routed instance below its final level needs the next officer named, and a Return may be
 * aimed at a specific colleague rather than left to land on whoever next opens the department
 * queue.
 */
export function ApprovalActionDialog({
  action,
  onClose,
}: {
  action: { task: ApprovalTask; kind: ActionKind } | null;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const [nextApproverId, setNextApproverId] = useState('');
  const [returnToUserId, setReturnToUserId] = useState('');

  // A manually-routed document, being approved below its final level, needs the approver to
  // name who it goes to next.
  const needsNextApprover =
    !!action &&
    action.kind === 'Approve' &&
    action.task.routingMode === 'Manual' &&
    action.task.stepNumber < (action.task.totalSteps || action.task.stepNumber);
  const officers = useQuery({
    queryKey: ['officers'],
    queryFn: () => approvalsApi.officers(),
    enabled: needsNextApprover,
  });

  const isReturn = action?.kind === 'Return';
  const orgUsers = useQuery({
    queryKey: ['org-users'],
    queryFn: () => approvalsApi.orgUsers(),
    enabled: isReturn,
  });

  const mutation = useMutation({
    mutationFn: () =>
      approvalsApi.act(action!.task.taskId, {
        action: action!.kind,
        remarks: remarks || undefined,
        nextApproverUserId: needsNextApprover ? nextApproverId : undefined,
        returnToUserId: isReturn && returnToUserId ? returnToUserId : undefined,
      }),
    onSuccess: (r) => {
      dispatch(showToast({ message: r.message, severity: r.isRejected ? 'info' : 'success' }));
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['contract'] });
      queryClient.invalidateQueries({ queryKey: ['work-order'] });
      // The detail screens' approval-progress card and history, so they show the action at once.
      queryClient.invalidateQueries({ queryKey: ['wf-progress'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      handleClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const handleClose = () => {
    setRemarks('');
    setNextApproverId('');
    setReturnToUserId('');
    onClose();
  };

  if (!action) return null;
  const { task, kind } = action;

  // A reject or return must state why; the step may also mandate remarks on approval.
  const remarksRequired = kind === 'Reject' || kind === 'Return' || (kind === 'Approve' && task.isRemarksMandatory);
  const canSubmit = (!remarksRequired || remarks.trim().length > 0) && (!needsNextApprover || !!nextApproverId);

  const verb = kind === 'Approve' ? 'Approve' : kind === 'Reject' ? 'Reject' : 'Return';
  const colour = kind === 'Approve' ? 'success' : kind === 'Reject' ? 'error' : 'warning';

  return (
    <Dialog open onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {verb} — {task.title ?? task.entityReference}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {task.entityType} {task.entityReference} · {task.stepName} (level {task.stepNumber} of{' '}
            {task.totalSteps || task.stepNumber})
          </Typography>
          {kind === 'Approve' &&
            task.stepNumber < (task.totalSteps || task.stepNumber) &&
            (needsNextApprover ? (
              <>
                <Alert severity="info">
                  Manual routing — choose the officer to send this to next (level {task.stepNumber + 1}).
                </Alert>
                <TextField
                  select
                  required
                  label="Next approver"
                  value={nextApproverId}
                  onChange={(e) => setNextApproverId(e.target.value)}
                  fullWidth
                >
                  {(officers.data ?? []).map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.fullName}
                      {o.designation ? ` · ${o.designation}` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            ) : (
              <Alert severity="info">
                This is not the final level — approving passes the document to level {task.stepNumber + 1}.
              </Alert>
            ))}
          {kind === 'Return' && (
            <>
              <Alert severity="warning">
                Returning sends the document back as an editable draft. Optionally name who it's
                for — they're notified and it's recorded on the document.
              </Alert>
              <TextField
                select
                label="Send to (optional)"
                value={returnToUserId}
                onChange={(e) => setReturnToUserId(e.target.value)}
                fullWidth
                helperText="Leave blank to just return it without naming anyone in particular"
              >
                <MenuItem value="">
                  <em>No one in particular</em>
                </MenuItem>
                {(orgUsers.data ?? []).map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.fullName}
                    {u.designation ? ` · ${u.designation}` : ''}
                    {u.departmentName ? ` · ${u.departmentName}` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
          {kind === 'Reject' && <Alert severity="error">Rejecting ends the approval; the document is closed as rejected.</Alert>}
          <TextField
            label={remarksRequired ? 'Remarks (required)' : 'Remarks (optional)'}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            autoFocus
          />
          <Divider />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          color={colour}
          variant="contained"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Working…' : `Confirm ${verb.toLowerCase()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
