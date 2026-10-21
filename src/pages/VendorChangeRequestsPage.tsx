import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Paper,
  Stack,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ManageAccounts,
  Add,
  ContactPhone,
  AccountBalance,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import { PageHeader } from '@/components/PageHeader';
import { RaiseVendorChangeDialog } from '@/components/RaiseVendorChangeDialog';
import { vendorChangeRequestsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { VendorChangeRequest } from '@/api/types';
import { relativeTime } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

/**
 * Vendor detail change requests. A vendor raises and tracks changes to their own contact or
 * bank details here; a NeGD reviewer sees the queue and approves or rejects. Bank changes
 * only take effect on approval — the two-person control the concept note requires.
 */
export function VendorChangeRequestsPage() {
  const { isVendor } = useAuth();
  const [raiseOpen, setRaiseOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['vendor-change-requests'],
    queryFn: () => vendorChangeRequestsApi.list(),
  });

  const [reviewing, setReviewing] = useState<{ req: VendorChangeRequest; approve: boolean } | null>(null);

  return (
    <>
      <PageHeader
        title="Vendor Change Requests"
        subtitle={
          isVendor
            ? 'Request changes to your contact or bank details — reviewed by NeGD before they take effect'
            : 'Review and approve vendor contact and bank-detail changes'
        }
        icon={<ManageAccounts />}
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setRaiseOpen(true)}>
            New change request
          </Button>
        }
      />

      {isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !data || data.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <ManageAccounts sx={{ fontSize: 42, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6">No change requests</Typography>
          <Typography variant="body2" color="text.secondary">
            Raise one with “New change request”.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {data.map((req) => (
            <ChangeRequestCard key={req.id} req={req} onReview={(approve) => setReviewing({ req, approve })} />
          ))}
        </Stack>
      )}

      <RaiseVendorChangeDialog open={raiseOpen} onClose={() => setRaiseOpen(false)} />
      <ReviewDialog reviewing={reviewing} onClose={() => setReviewing(null)} />
    </>
  );
}

const STATUS_COLOR: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'error',
  Cancelled: 'default',
};

function ChangeRequestCard({
  req,
  onReview,
}: {
  req: VendorChangeRequest;
  onReview: (approve: boolean) => void;
}) {
  const { can } = useAuth();
  // Authority mirrors the server: contact → vendor.update, bank → vendor.bankdetails.verify.
  const canReview =
    req.status === 'Pending' &&
    (req.requestType === 'BankAccount'
      ? can(Permissions.vendorBankDetailsVerify)
      : can(Permissions.vendorUpdate));

  return (
    <Paper sx={{ p: 2.5 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              icon={req.requestType === 'BankAccount' ? <AccountBalance fontSize="small" /> : <ContactPhone fontSize="small" />}
              label={req.requestType === 'BankAccount' ? 'Bank account' : 'Contact details'}
              size="small"
              variant="outlined"
            />
            <Typography variant="subtitle1" fontWeight={700}>
              {req.vendorName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {req.vendorCode}
            </Typography>
            <Chip label={req.status} size="small" color={STATUS_COLOR[req.status] ?? 'default'} />
          </Stack>

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Raised {relativeTime(req.createdOn)}
            {req.raisedByUser ? ` by ${req.raisedByUser}` : ''}
            {req.raisedByVendor ? ' (vendor)' : ''}
          </Typography>

          <Box sx={{ mt: 1 }}>
            <ProposedValues req={req} />
          </Box>

          {req.reason && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
              Reason: {req.reason}
            </Typography>
          )}

          {req.status !== 'Pending' && req.reviewedByUser && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {req.status} by {req.reviewedByUser}
              {req.reviewedOn ? ` ${relativeTime(req.reviewedOn)}` : ''}
              {req.reviewRemarks ? ` — “${req.reviewRemarks}”` : ''}
            </Typography>
          )}
        </Box>

        {canReview && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Button color="error" variant="outlined" startIcon={<Cancel />} onClick={() => onReview(false)}>
              Reject
            </Button>
            <Button color="success" variant="contained" startIcon={<CheckCircle />} onClick={() => onReview(true)}>
              Approve
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

/** The proposed new values, rendered compactly by request type. */
function ProposedValues({ req }: { req: VendorChangeRequest }) {
  const rows =
    req.requestType === 'BankAccount'
      ? [
          ['Account holder', req.newAccountHolderName],
          ['Account no.', req.newAccountNumber],
          ['IFSC', req.newIfscCode],
          ['Bank', req.newBankName],
          ['Branch', req.newBranchName],
          ['Type', req.newAccountType],
        ]
      : [
          ['Contact person', req.newContactPersonName],
          ['Mobile', req.newMobile],
          ['Alt. phone', req.newAlternatePhone],
          ['Email', req.newEmail],
        ];

  const present = rows.filter((r): r is [string, string] => !!r[1]);
  if (present.length === 0) return null;
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.1 : 0.04),
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.66rem', fontWeight: 700, display: 'block', mb: 1 }}
      >
        Requested {req.requestType === 'BankAccount' ? 'bank account' : 'contact'} details
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
        {present.map(([label, value]) => (
          <Box key={label}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ textTransform: 'uppercase', letterSpacing: 0.4, fontSize: '0.62rem', fontWeight: 700 }}
            >
              {label}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ReviewDialog({
  reviewing,
  onClose,
}: {
  reviewing: { req: VendorChangeRequest; approve: boolean } | null;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      vendorChangeRequestsApi.review(reviewing!.req.id, {
        approve: reviewing!.approve,
        remarks: remarks || undefined,
      }),
    onSuccess: (r) => {
      dispatch(showToast({ message: r.message, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['vendor-change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      close();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const close = () => {
    setRemarks('');
    onClose();
  };

  if (!reviewing) return null;
  const { req, approve } = reviewing;
  const isBank = req.requestType === 'BankAccount';

  return (
    <Dialog open onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>
        {approve ? 'Approve' : 'Reject'} change — {req.vendorName}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {approve && isBank && (
            <Alert severity="warning">
              Approving replaces the vendor's primary bank account. The new account starts
              unverified and must be re-verified before payments resume.
            </Alert>
          )}
          {!approve && <Alert severity="info">Rejecting changes nothing on the vendor's record.</Alert>}
          <Divider />
          <ProposedValues req={req} />
          <TextField
            label={approve ? 'Remarks (optional)' : 'Reason for rejection (required)'}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={close} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          color={approve ? 'success' : 'error'}
          variant="contained"
          disabled={mutation.isPending || (!approve && remarks.trim().length === 0)}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Working…' : approve ? 'Confirm approval' : 'Confirm rejection'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
