import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Box,
  Divider,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  TextField,
  Alert,
  Avatar,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import Grid from '@mui/material/Grid2';
import { CheckCircle, Cancel, VerifiedUser, AccountBalance } from '@mui/icons-material';
import { vendorsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { StatusChip } from '@/components/StatusChip';
import { BankAccountPanel } from '@/components/BankAccountPanel';
import { initials } from '@/lib/initials';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';

/**
 * The registration review. An officer holding <c>vendor.verify</c> confirms the vendor's
 * statutory identifiers (GST, PAN), then approves — activating the vendor — or rejects with
 * a mandatory reason. A vendor cannot be activated until GST and PAN are both confirmed,
 * which mirrors the server-side rule. Bank details are not confirmed here; when none are on
 * file the dialog warns that they are needed before invoices can be raised and approved.
 */
export function VendorReviewDialog({
  vendorId,
  open,
  onClose,
}: {
  vendorId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canVerify = can(Permissions.vendorVerify);

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: () => vendorsApi.get(vendorId!),
    enabled: open && !!vendorId,
  });

  const [gstVerified, setGstVerified] = useState(true);
  const [panVerified, setPanVerified] = useState(true);
  const [remarks, setRemarks] = useState('');

  // Seed the checkboxes from the vendor's current standing whenever a new one loads.
  useEffect(() => {
    if (vendor) {
      setGstVerified(vendor.isGstVerified);
      setPanVerified(vendor.isPanVerified);
      setRemarks('');
    }
  }, [vendor]);

  const mutation = useMutation({
    mutationFn: (isApproved: boolean) =>
      vendorsApi.verify(vendorId!, {
        isApproved,
        gstVerified,
        panVerified,
        // Not decided in this step: the vendor's current bank standing is kept as it is.
        bankVerified: vendor?.isBankVerified ?? false,
        remarks: remarks || undefined,
      }),
    onSuccess: (_r, isApproved) => {
      dispatch(
        showToast({
          message: isApproved
            ? `${vendor?.legalName} approved and activated.`
            : `${vendor?.legalName} registration rejected.`,
          severity: isApproved ? 'success' : 'info',
        })
      );
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const isPending = vendor?.status === 'PendingVerification' || vendor?.status === 'Draft';
  const canApprove = gstVerified && panVerified;
  const canReject = remarks.trim().length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <span>Vendor review</span>
          {vendor && <StatusChip status={vendor.status} />}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading || !vendor ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.75} alignItems="center">
              <Avatar
                variant="rounded"
                sx={{
                  width: 48,
                  height: 48,
                  fontSize: 16,
                  fontWeight: 800,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                  color: 'primary.main',
                }}
              >
                {initials(vendor.legalName)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ lineHeight: 1.25 }}>
                  {vendor.legalName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {vendor.vendorCode} · {vendor.constitution} · registered{' '}
                  {vendor.registrationDate ? new Date(vendor.registrationDate).toLocaleDateString('en-IN') : '—'}
                </Typography>
              </Box>
            </Stack>

            {/* GST-sourced particulars */}
            <Box>
              <SectionLabel icon={<VerifiedUser fontSize="small" color="success" />} label="Statutory (from GSTN)" />
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Field label="GSTIN" value={vendor.gstin} />
                <Field label="PAN" value={vendor.pan} />
                <Field label="Trade name" value={vendor.tradeName ?? '—'} />
                <Field
                  label="MSME"
                  value={vendor.msmeCategory === 'NotRegistered' ? 'Not registered' : vendor.msmeCategory}
                />
                <Field
                  label="Address"
                  value={[vendor.addressLine1, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ')}
                  full
                />
              </Grid>
            </Box>

            {/* Contact */}
            <Box>
              <SectionLabel label="Contact" />
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Field label="Contact person" value={vendor.contactPersonName} />
                <Field label="Email" value={vendor.email} />
                <Field label="Mobile" value={vendor.mobile} />
                {vendor.website && <Field label="Website" value={vendor.website} />}
              </Grid>
            </Box>

            {/* Bank accounts */}
            <Box>
              <SectionLabel icon={<AccountBalance fontSize="small" />} label="Bank accounts" />
              {vendor.bankAccounts.length === 0 ? (
                <Alert severity="warning" sx={{ mt: 0.75 }}>
                  <strong>Bank account details required.</strong> No bank account is on file for this vendor. A bank
                  account is required before invoices can be created and approved. Add it through a Bank account change
                  request (Change Requests), or ask the vendor to add it from their portal.
                </Alert>
              ) : (
                <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                  {vendor.bankAccounts.map((b) => (
                    <BankAccountPanel
                      key={b.id}
                      bankName={`${b.bankName} · ${b.accountType}`}
                      accountNumber={b.accountNumber}
                      ifscCode={b.ifscCode}
                      isPrimary={b.isPrimary}
                      accountHolderName={b.accountHolderName}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {vendor.remarks && (
              <Alert severity="info" variant="outlined">
                Prior remarks: {vendor.remarks}
              </Alert>
            )}

            {/* The decision */}
            {isPending && canVerify && (
              <>
                <Divider />
                <Box>
                  <SectionLabel label="Verification decision" />
                  <Stack direction="row" flexWrap="wrap" sx={{ mt: 0.5 }}>
                    <FormControlLabel
                      control={<Checkbox checked={gstVerified} onChange={(e) => setGstVerified(e.target.checked)} />}
                      label="GST verified"
                    />
                    <FormControlLabel
                      control={<Checkbox checked={panVerified} onChange={(e) => setPanVerified(e.target.checked)} />}
                      label="PAN verified"
                    />
                  </Stack>
                  {!canApprove && (
                    <Typography variant="caption" color="warning.main">
                      GST and PAN must both be verified before the vendor can be activated.
                    </Typography>
                  )}
                  <TextField
                    label="Remarks (required to reject)"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                    sx={{ mt: 1.5 }}
                  />
                </Box>
              </>
            )}

            {!isPending && (
              <Alert severity="info">This vendor is {vendor.status} and is not awaiting verification.</Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Close
        </Button>
        {isPending && canVerify && (
          <>
            <Button
              color="error"
              variant="outlined"
              startIcon={<Cancel />}
              disabled={!canReject || mutation.isPending}
              onClick={() => mutation.mutate(false)}
            >
              Reject
            </Button>
            <Button
              color="success"
              variant="contained"
              startIcon={<CheckCircle />}
              disabled={!canApprove || mutation.isPending}
              onClick={() => mutation.mutate(true)}
            >
              {mutation.isPending ? 'Saving…' : 'Approve & activate'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function SectionLabel({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {icon}
      <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
        {label}
      </Typography>
    </Stack>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <Grid size={{ xs: 12, sm: full ? 12 : 6 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value}
      </Typography>
    </Grid>
  );
}
