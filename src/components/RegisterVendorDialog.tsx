import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Alert,
  Divider,
  Chip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { vendorsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { GstTaxpayerDetails, ExistingVendorSummary } from '@/api/types';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

const CONSTITUTIONS = [
  'Proprietorship',
  'Partnership',
  'LimitedLiabilityPartnership',
  'PrivateLimited',
  'PublicLimited',
  'Trust',
  'Society',
  'HinduUndividedFamily',
  'GovernmentEntity',
];

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

/**
 * Lets an NeGD officer register a vendor. Bank details are intentionally NOT collected here —
 * the vendor adds and owns them from the portal. GSTIN Fetch auto-fills the statutory fields
 * and warns if the GSTIN is already registered.
 */
export function RegisterVendorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const [gstin, setGstin] = useState('');
  const [existingReg, setExistingReg] = useState<ExistingVendorSummary | null>(null);

  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [pan, setPan] = useState('');
  const [constitution, setConstitution] = useState('');

  const [contactPersonName, setContactPersonName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [website, setWebsite] = useState('');

  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [remarks, setRemarks] = useState('');

  const applyGst = (gst: GstTaxpayerDetails) => {
    setLegalName(gst.legalName);
    setTradeName(gst.tradeName ?? '');
    setPan(gst.pan);
    setConstitution(gst.constitution);
    setAddressLine1(gst.addressLine1);
    setAddressLine2(gst.addressLine2 ?? '');
    setCity(gst.city);
    setState(gst.state);
    setPincode(gst.pincode);
  };

  const lookup = useMutation({
    mutationFn: () => vendorsApi.lookupGstin(gstin),
    onSuccess: (r) => {
      setExistingReg(r.alreadyRegistered);
      if (r.gst) applyGst(r.gst);
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const register = useMutation({
    mutationFn: () =>
      vendorsApi.register({
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || undefined,
        constitution,
        gstin: gstin.trim().toUpperCase(),
        pan: pan.trim().toUpperCase(),
        contactPersonName: contactPersonName.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        alternatePhone: alternatePhone.trim() || undefined,
        website: website.trim() || undefined,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: (r) => {
      dispatch(showToast({ message: `Vendor ${r.vendorCode} registered — pending verification.`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const gstinValid = GSTIN_RE.test(gstin.toUpperCase());
  const canSubmit =
    !existingReg &&
    gstinValid &&
    legalName.trim().length > 0 &&
    pan.trim().length === 10 &&
    !!constitution &&
    contactPersonName.trim().length > 0 &&
    /^\S+@\S+\.\S+$/.test(email) &&
    /^[6-9]\d{9}$/.test(mobile) &&
    addressLine1.trim().length > 0 &&
    city.trim().length > 0 &&
    state.trim().length > 0 &&
    /^\d{6}$/.test(pincode);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Register vendor</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Alert severity="info">
            Bank details are not collected here — the vendor adds them from their portal after verification.
          </Alert>

          {/* GSTIN + fetch */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
            <TextField
              label="GSTIN"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 15))}
              fullWidth
              error={!!gstin && !gstinValid}
              helperText={!!gstin && !gstinValid ? 'A GSTIN is 15 characters.' : 'Fetch to auto-fill statutory fields.'}
            />
            <Button
              variant="outlined"
              sx={{ mt: 0.5, minWidth: 110, height: 56 }}
              disabled={!gstinValid || lookup.isPending}
              onClick={() => lookup.mutate()}
            >
              {lookup.isPending ? 'Fetching…' : 'Fetch'}
            </Button>
          </Stack>

          {existingReg && (
            <Alert severity="warning">
              <strong>{existingReg.legalName}</strong> is already registered under this GSTIN
              (vendor code {existingReg.vendorCode}, status {existingReg.status}).
            </Alert>
          )}

          <Divider><Chip label="Organisation" size="small" /></Divider>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField label="Legal name" value={legalName} onChange={(e) => setLegalName(e.target.value)} fullWidth required />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Trade name" value={tradeName} onChange={(e) => setTradeName(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField label="PAN" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))} fullWidth required />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField select label="Constitution" value={constitution} onChange={(e) => setConstitution(e.target.value)} fullWidth required>
                {CONSTITUTIONS.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          <Divider><Chip label="Contact" size="small" /></Divider>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Contact person" value={contactPersonName} onChange={(e) => setContactPersonName(e.target.value)} fullWidth required />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField label="Primary phone" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} fullWidth required />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField label="Alternate phone" value={alternatePhone} onChange={(e) => setAlternatePhone(e.target.value.replace(/\D/g, '').slice(0, 10))} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} fullWidth />
            </Grid>
          </Grid>

          <Divider><Chip label="Registered address" size="small" /></Divider>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Address line 1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} fullWidth required />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Address line 2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} fullWidth />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} fullWidth required />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField label="State" value={state} onChange={(e) => setState(e.target.value)} fullWidth required />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField label="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} fullWidth required />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} fullWidth multiline minRows={2} />
            </Grid>
          </Grid>

          {register.isError && <Alert severity="error">{errorMessage(register.error)}</Alert>}
          <Typography variant="caption" color="text.secondary">
            The vendor is created as Pending Verification and must be verified before any work is awarded.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={register.isPending}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit || register.isPending} onClick={() => register.mutate()}>
          {register.isPending ? 'Registering…' : 'Register vendor'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
