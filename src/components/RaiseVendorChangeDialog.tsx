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
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Autocomplete,
} from '@mui/material';
import { ContactPhone, AccountBalance } from '@mui/icons-material';
import { vendorChangeRequestsApi, vendorsApi, type RaiseVendorChangeBody } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/lib/useAuth';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

type Kind = 'Contact' | 'BankAccount';

const ACCOUNT_TYPES = ['Current', 'Savings', 'CashCredit', 'OverDraft'];
const MOBILE_RE = /^[6-9]\d{9}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Raise a request to change a vendor's contact or bank particulars. Nothing changes until approved. */
export function RaiseVendorChangeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isVendor } = useAuth();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<Kind>('Contact');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  // Contact
  const [contactPersonName, setContactPersonName] = useState('');
  const [mobile, setMobile] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  // Bank
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountType, setAccountType] = useState('Current');

  // Staff must name the vendor; a vendor user changes only their own record.
  const vendorsQuery = useQuery({
    queryKey: ['vendors', 'picker'],
    queryFn: () => vendorsApi.list({ pageSize: 100 }),
    enabled: open && !isVendor,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const body: RaiseVendorChangeBody = { requestType: kind, reason: reason || undefined };
      if (!isVendor) body.vendorId = vendorId ?? undefined;
      if (kind === 'Contact') {
        Object.assign(body, {
          newContactPersonName: contactPersonName || undefined,
          newMobile: mobile || undefined,
          newAlternatePhone: alternatePhone || undefined,
          newEmail: email || undefined,
        });
      } else {
        Object.assign(body, {
          newAccountHolderName: accountHolderName || undefined,
          newAccountNumber: accountNumber || undefined,
          newIfscCode: ifscCode || undefined,
          newBankName: bankName || undefined,
          newBranchName: branchName || undefined,
          newAccountType: accountType,
        });
      }
      return vendorChangeRequestsApi.raise(body);
    },
    onSuccess: (r) => {
      dispatch(showToast({ message: r.message, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['vendor-change-requests'] });
      handleClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const handleClose = () => {
    setKind('Contact');
    setVendorId(null);
    setReason('');
    setContactPersonName('');
    setMobile('');
    setAlternatePhone('');
    setEmail('');
    setAccountHolderName('');
    setAccountNumber('');
    setIfscCode('');
    setBankName('');
    setBranchName('');
    setAccountType('Current');
    onClose();
  };

  const contactValid =
    (!!contactPersonName || !!mobile || !!alternatePhone || !!email) &&
    (!mobile || MOBILE_RE.test(mobile)) &&
    (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const bankValid =
    accountHolderName.trim().length > 0 &&
    /^\d{9,18}$/.test(accountNumber) &&
    IFSC_RE.test(ifscCode.toUpperCase()) &&
    bankName.trim().length > 0;
  const vendorOk = isVendor || !!vendorId;
  const canSubmit = vendorOk && (kind === 'Contact' ? contactValid : bankValid);

  const vendorOptions = (vendorsQuery.data?.items ?? []).map((v) => ({
    id: v.id,
    label: `${v.legalName} (${v.vendorCode})`,
  }));

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Request a detail change</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <ToggleButtonGroup
            exclusive
            value={kind}
            onChange={(_, v) => v && setKind(v)}
            fullWidth
            size="small"
          >
            <ToggleButton value="Contact">
              <ContactPhone fontSize="small" sx={{ mr: 1 }} /> Contact details
            </ToggleButton>
            <ToggleButton value="BankAccount">
              <AccountBalance fontSize="small" sx={{ mr: 1 }} /> Bank account
            </ToggleButton>
          </ToggleButtonGroup>

          {kind === 'BankAccount' && (
            <Alert severity="info">
              Bank changes take effect only after a reviewer (finance / NeGD) approves them.
            </Alert>
          )}

          {!isVendor && (
            <Autocomplete
              options={vendorOptions}
              loading={vendorsQuery.isLoading}
              onChange={(_, v) => setVendorId(v?.id ?? null)}
              renderInput={(params) => <TextField {...params} label="Vendor" required />}
            />
          )}

          {kind === 'Contact' ? (
            <>
              <TextField
                label="New contact person"
                value={contactPersonName}
                onChange={(e) => setContactPersonName(e.target.value)}
                fullWidth
              />
              <TextField
                label="New mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                error={!!mobile && !MOBILE_RE.test(mobile)}
                helperText={!!mobile && !MOBILE_RE.test(mobile) ? 'Enter a valid 10-digit mobile.' : ' '}
                fullWidth
              />
              <TextField
                label="New alternate phone"
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                fullWidth
              />
              <TextField
                label="New email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
              />
            </>
          ) : (
            <>
              <TextField
                label="Account holder name"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Account number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 18))}
                error={!!accountNumber && !/^\d{9,18}$/.test(accountNumber)}
                helperText={!!accountNumber && !/^\d{9,18}$/.test(accountNumber) ? '9 to 18 digits.' : ' '}
                required
                fullWidth
              />
              <TextField
                label="IFSC code"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 11))}
                error={!!ifscCode && !IFSC_RE.test(ifscCode)}
                helperText={!!ifscCode && !IFSC_RE.test(ifscCode) ? 'An IFSC is 11 characters.' : ' '}
                required
                fullWidth
              />
              <TextField
                label="Bank name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Branch (optional)"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                fullWidth
              />
              <TextField
                select
                label="Account type"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                fullWidth
              >
                {ACCOUNT_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}

          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Submitting…' : 'Submit request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
