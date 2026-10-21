import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Stack,
  Typography,
  Chip,
  CircularProgress,
  Divider,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Undo,
  RadioButtonChecked,
  RadioButtonUnchecked,
  RemoveCircle,
  HourglassTop,
  SwapHoriz,
} from '@mui/icons-material';
import { workflowsApi, approvalsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { WorkflowStepProgress } from '@/api/types';
import { dateTime } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

const STATUS_COLOR: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  Approved: 'success',
  Rejected: 'error',
  Cancelled: 'error',
  InProgress: 'info',
  Escalated: 'warning',
};

/**
 * The approval trail for a document — every level, who it is with, what each approver
 * decided, and where it is pending now. This is the transparency surface: instead of a bare
 * "Pending Approval" status, a user sees "pending at Scrutiny with the Contract Officer".
 */
export function WorkflowProgress({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { can } = useAuth();
  const canReassign = can(Permissions.workflowUpdate);
  const [reassign, setReassign] = useState<{ taskId: string; stepName: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['wf-progress', entityType, entityId],
    queryFn: () => workflowsApi.progress(entityType, entityId),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (!data || !data.hasWorkflow) {
    return (
      <Alert severity="info" variant="outlined">
        {data?.summary ?? 'No approval is running for this document.'}
      </Alert>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {/* Labelled so it is clear this is the approval workflow's outcome — a separate
            thing from the document's own status shown at the top of the drawer. */}
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          Approval status:
        </Typography>
        <Chip
          label={data.status}
          size="small"
          color={STATUS_COLOR[data.status] ?? 'default'}
          variant={data.status === 'InProgress' ? 'outlined' : 'filled'}
        />
        <Typography variant="body2" fontWeight={600}>
          {data.summary}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {data.workflowName} · {data.totalSteps} level{data.totalSteps === 1 ? '' : 's'}
        {data.initiatedBy ? ` · initiated by ${data.initiatedBy}` : ''}
      </Typography>

      <Divider />

      <Stack spacing={0}>
        {data.steps.map((step, i) => (
          <StepRow
            key={step.stepNumber}
            step={step}
            isLast={i === data.steps.length - 1}
            onReassign={
              canReassign && step.isCurrent && step.taskId
                ? () => setReassign({ taskId: step.taskId!, stepName: step.stepName })
                : undefined
            }
          />
        ))}
      </Stack>

      {reassign && (
        <ReassignDialog
          taskId={reassign.taskId}
          stepName={reassign.stepName}
          entityType={entityType}
          entityId={entityId}
          onClose={() => setReassign(null)}
        />
      )}
    </Stack>
  );
}

function StepRow({
  step,
  isLast,
  onReassign,
}: {
  step: WorkflowStepProgress;
  isLast: boolean;
  onReassign?: () => void;
}) {
  const { icon, tint } = statusVisual(step);

  return (
    <Stack direction="row" spacing={1.5} alignItems="stretch">
      {/* Rail: the status marker plus a connector down to the next level. */}
      <Stack alignItems="center" sx={{ width: 24 }}>
        <Box sx={{ color: tint, display: 'grid', placeItems: 'center', mt: 0.25 }}>{icon}</Box>
        {!isLast && <Box sx={{ flex: 1, width: 2, bgcolor: 'divider', my: 0.25 }} />}
      </Stack>

      <Box sx={{ pb: isLast ? 0 : 2, flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle2" fontWeight={700}>
            Level {step.stepNumber} · {step.stepName}
          </Typography>
          {step.isCurrent && <Chip label="Pending here" size="small" color="info" />}
          {step.isOverdue && <Chip label="Overdue" size="small" color="error" variant="outlined" />}
          {step.status === 'Approved' && <Chip label="Approved" size="small" color="success" variant="outlined" />}
          {step.status === 'Rejected' && <Chip label="Rejected" size="small" color="error" variant="outlined" />}
          {step.status === 'ReturnedForClarification' && (
            <Chip label="Returned" size="small" color="warning" variant="outlined" />
          )}
          {onReassign && (
            <Button
              size="small"
              variant="text"
              startIcon={<SwapHoriz fontSize="small" />}
              onClick={onReassign}
              sx={{ py: 0, minWidth: 0 }}
            >
              Reassign
            </Button>
          )}
        </Stack>

        <Typography variant="caption" color="text.secondary" display="block">
          {whoLine(step)}
        </Typography>

        {step.actionedOn && (
          <Typography variant="caption" color="text.secondary" display="block">
            Actioned {dateTime(step.actionedOn)}
          </Typography>
        )}

        {step.remarks && (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.5, fontStyle: 'italic', color: 'text.primary' }}
          >
            “{step.remarks}”
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

/** Admin fallback: move a pending task to another user when the assignee is unavailable. */
function ReassignDialog({
  taskId,
  stepName,
  entityType,
  entityId,
  onClose,
}: {
  taskId: string;
  stepName: string;
  entityType: string;
  entityId: string;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');
  const [remarks, setRemarks] = useState('');

  // Only users holding this step's role can take the task — same-role substitutes.
  const users = useQuery({
    queryKey: ['reassign-candidates', taskId],
    queryFn: () => approvalsApi.reassignCandidates(taskId),
  });

  const mutation = useMutation({
    mutationFn: () => approvalsApi.reassign(taskId, { newUserId: userId, remarks: remarks || undefined }),
    onSuccess: () => {
      dispatch(showToast({ message: 'Task reassigned.', severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['wf-progress', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['timeline', entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  // Deduplicate the (user, role) rows into a distinct user list.
  const distinctUsers = Array.from(
    new Map((users.data ?? []).map((u) => [u.id, u])).values()
  ).sort((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Reassign — {stepName}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Move this pending step to another user when the current approver is unavailable. The
            step and its deadline are unchanged — only who must act on it.
          </Typography>
          <TextField
            select
            label="Reassign to"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            fullWidth
            required
          >
            {distinctUsers.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.fullName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Reason (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!userId || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Reassigning…' : 'Reassign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The one-line "who" beneath a level: with whom now, who acted, or which role is next. */
function whoLine(step: WorkflowStepProgress): string {
  if (step.isCurrent) {
    return step.assignedToUser
      ? `Pending with ${step.assignedToUser}${step.assignedRole ? ` (${step.assignedRole})` : ''}`
      : `Awaiting ${step.assignedRole ?? 'assignment'}`;
  }
  if (step.actionedBy) {
    const verb =
      step.status === 'Approved' ? 'Approved by' : step.status === 'Rejected' ? 'Rejected by' : 'Actioned by';
    return `${verb} ${step.actionedBy}`;
  }
  if (step.status === 'NotStarted') {
    return `Not yet reached · routes to ${step.assignedRole ?? 'the configured role'}`;
  }
  return step.assignedRole ?? '';
}

function statusVisual(step: WorkflowStepProgress): { icon: React.ReactNode; tint: string } {
  if (step.isCurrent) return { icon: <RadioButtonChecked fontSize="small" />, tint: 'info.main' };
  switch (step.status) {
    case 'Approved':
      return { icon: <CheckCircle fontSize="small" />, tint: 'success.main' };
    case 'Rejected':
      return { icon: <Cancel fontSize="small" />, tint: 'error.main' };
    case 'ReturnedForClarification':
      return { icon: <Undo fontSize="small" />, tint: 'warning.main' };
    case 'Skipped':
      return { icon: <RemoveCircle fontSize="small" />, tint: 'text.disabled' };
    case 'Pending':
      return { icon: <HourglassTop fontSize="small" />, tint: 'info.main' };
    default:
      return { icon: <RadioButtonUnchecked fontSize="small" />, tint: 'text.disabled' };
  }
}
