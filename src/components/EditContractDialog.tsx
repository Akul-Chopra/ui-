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
  Typography,
  FormControlLabel,
  Switch,
  Box,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { contractsApi, type UpdateContractBody } from '@/api/endpoints';
import type { ContractDetail } from '@/api/types';
import { Section, SECURITY_INSTRUMENT_OPTIONS } from '@/components/CreateContractDialog';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';
import { useLookups, useActiveVendors } from '@/lib/useLookups';

function toBody(c: ContractDetail): UpdateContractBody {
  return {
    title: c.title,
    description: c.description,
    vendorId: c.vendorId,
    departmentId: c.departmentId,
    verticalId: c.verticalId,
    contractCategoryId: c.contractCategoryId,
    contractSelectionModeId: c.contractSelectionModeId,
    contractForId: c.contractForId,
    contractForOther: c.contractForOther,
    contractValue: c.contractValue,
    startDate: c.startDate.slice(0, 10),
    endDate: c.endDate.slice(0, 10),
    signedDate: c.signedDate?.slice(0, 10),
    scopeOfWork: c.scopeOfWork,
    termsAndConditions: c.termsAndConditions,
    paymentTerms: c.paymentTerms,
    complianceTerms: c.complianceTerms,
    indemnificationTerms: c.indemnificationTerms,
    disputeResolution: c.disputeResolution,
    retentionPercentage: c.retentionPercentage,
    securityDepositAmount: c.securityDepositAmount,
    sdInstrumentType: c.sdInstrumentType,
    sdInstrumentNumber: c.sdInstrumentNumber,
    sdInstrumentDate: c.sdInstrumentDate?.slice(0, 10),
    sdInstrumentValidityDate: c.sdInstrumentValidityDate?.slice(0, 10),
    isRenewable: c.isRenewable,
    renewalPeriodMonths: c.renewalPeriodMonths,
    remarks: c.remarks,
  };
}

/**
 * Corrects a contract in place — the section Approver's (or an administrator's) tool for
 * fixing a mistake after the fact: a typo'd value, the wrong vendor, a date entered wrong.
 * Unlike an amendment, this does not version the contract or touch its approval — the
 * running or already-cleared workflow is left exactly as it is.
 */
export function EditContractDialog({
  open,
  onClose,
  contract,
}: {
  open: boolean;
  onClose: () => void;
  contract: ContractDetail;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lookups = useLookups(open);
  const vendors = useActiveVendors(open);

  const [form, setForm] = useState<UpdateContractBody>(() => toBody(contract));

  const set = <K extends keyof UpdateContractBody>(key: K, value: UpdateContractBody[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () =>
      contractsApi.update(contract.id, {
        ...form,
        contractForOther: isOtherContractFor ? form.contractForOther?.trim() || undefined : undefined,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        signedDate: form.signedDate ? new Date(form.signedDate).toISOString() : undefined,
        sdInstrumentDate: form.sdInstrumentDate ? new Date(form.sdInstrumentDate).toISOString() : undefined,
        sdInstrumentValidityDate: form.sdInstrumentValidityDate
          ? new Date(form.sdInstrumentValidityDate).toISOString()
          : undefined,
      }),
    onSuccess: () => {
      dispatch(showToast({ message: `${contract.contractNumber} corrected.`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['contract', contract.id] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const selectedContractFor = (lookups.data?.contractFors ?? []).find((f) => f.id === form.contractForId);
  const isOtherContractFor = selectedContractFor?.name.trim().toLowerCase() === 'other';

  const valid =
    form.title.trim().length > 0 &&
    !!form.vendorId &&
    form.contractValue > 0 &&
    (!isOtherContractFor || (form.contractForOther?.trim().length ?? 0) > 0) &&
    form.endDate >= form.startDate;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Correct {contract.contractNumber}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Alert severity="info">
            This corrects the contract's own record. It does not change or restart the approval
            already recorded against it.
          </Alert>

          <Section title="Parties & Purpose" defaultExpanded>
            <TextField
              label="Contract title / purpose"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              fullWidth
              required
              autoFocus
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Vendor (supplier)"
                  value={form.vendorId}
                  onChange={(e) => set('vendorId', e.target.value)}
                  fullWidth
                  required
                >
                  {!(vendors.data?.items ?? []).some((v) => v.id === contract.vendorId) && (
                    <MenuItem value={contract.vendorId}>{contract.vendorName} (current)</MenuItem>
                  )}
                  {(vendors.data?.items ?? []).map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.legalName} · {v.vendorCode}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Vertical / Division / Section"
                  value={form.verticalId ?? ''}
                  onChange={(e) => set('verticalId', e.target.value || undefined)}
                  fullWidth
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {(lookups.data?.verticals ?? []).map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Contract Category (optional)"
                  value={form.contractCategoryId ?? ''}
                  onChange={(e) => set('contractCategoryId', e.target.value || undefined)}
                  fullWidth
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {(lookups.data?.contractCategories ?? []).map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Contract Selection Mode (optional)"
                  value={form.contractSelectionModeId ?? ''}
                  onChange={(e) => set('contractSelectionModeId', e.target.value || undefined)}
                  fullWidth
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {(lookups.data?.contractSelectionModes ?? []).map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: isOtherContractFor ? 6 : 12 }}>
                <TextField
                  select
                  label="Contract For (optional)"
                  value={form.contractForId ?? ''}
                  onChange={(e) => set('contractForId', e.target.value || undefined)}
                  fullWidth
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {(lookups.data?.contractFors ?? []).map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              {isOtherContractFor && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Please specify"
                    value={form.contractForOther ?? ''}
                    onChange={(e) => set('contractForOther', e.target.value)}
                    fullWidth
                    required
                  />
                </Grid>
              )}
            </Grid>
          </Section>

          <Section title="Scope of Work">
            <TextField
              label="Scope of work (optional)"
              value={form.scopeOfWork ?? ''}
              onChange={(e) => set('scopeOfWork', e.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Section>

          <Section title="Cost & Payment" defaultExpanded>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Total contract value (₹)"
                  type="number"
                  value={form.contractValue || ''}
                  onChange={(e) => set('contractValue', Number(e.target.value))}
                  fullWidth
                  required
                  helperText={
                    contract.committedValue > 0
                      ? `Cannot go below ₹${contract.committedValue.toLocaleString('en-IN')} already committed through purchase orders / work orders.`
                      : ' '
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Security deposit (₹) (optional)"
                  type="number"
                  value={form.securityDepositAmount ?? ''}
                  onChange={(e) => set('securityDepositAmount', e.target.value ? Number(e.target.value) : undefined)}
                  fullWidth
                />
              </Grid>
            </Grid>
            {(form.securityDepositAmount ?? 0) > 0 && (
              <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'action.hover' }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Security deposit instrument
                </Typography>
                <Grid container spacing={1.5} sx={{ mt: 0.25 }}>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TextField
                      select
                      label="Instrument"
                      value={form.sdInstrumentType ?? ''}
                      onChange={(e) => set('sdInstrumentType', e.target.value || undefined)}
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="">
                        <em>—</em>
                      </MenuItem>
                      {SECURITY_INSTRUMENT_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField
                      label="Instrument No."
                      value={form.sdInstrumentNumber ?? ''}
                      onChange={(e) => set('sdInstrumentNumber', e.target.value || undefined)}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField
                      label="Instrument date"
                      type="date"
                      value={form.sdInstrumentDate ?? ''}
                      onChange={(e) => set('sdInstrumentDate', e.target.value || undefined)}
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField
                      label="Valid till"
                      type="date"
                      value={form.sdInstrumentValidityDate ?? ''}
                      onChange={(e) => set('sdInstrumentValidityDate', e.target.value || undefined)}
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
            <TextField
              label="Payment terms (optional)"
              value={form.paymentTerms ?? ''}
              onChange={(e) => set('paymentTerms', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Section>

          <Section title="Contract Terms & Legal Clauses">
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label="Signing date (optional)"
                  type="date"
                  value={form.signedDate ?? ''}
                  onChange={(e) => set('signedDate', e.target.value || undefined)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label="Start date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label="End date"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!form.isRenewable}
                      onChange={(e) => {
                        set('isRenewable', e.target.checked);
                        if (!e.target.checked) set('renewalPeriodMonths', undefined);
                      }}
                    />
                  }
                  label="Renewable"
                />
              </Grid>
              {form.isRenewable && (
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="Renewal period (months)"
                    type="number"
                    value={form.renewalPeriodMonths ?? ''}
                    onChange={(e) => set('renewalPeriodMonths', e.target.value ? Number(e.target.value) : undefined)}
                    fullWidth
                    size="small"
                  />
                </Grid>
              )}
            </Grid>
            <TextField
              label="General conditions (optional)"
              value={form.termsAndConditions ?? ''}
              onChange={(e) => set('termsAndConditions', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Compliance (optional)"
              value={form.complianceTerms ?? ''}
              onChange={(e) => set('complianceTerms', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Indemnification (optional)"
              value={form.indemnificationTerms ?? ''}
              onChange={(e) => set('indemnificationTerms', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Dispute resolution (optional)"
              value={form.disputeResolution ?? ''}
              onChange={(e) => set('disputeResolution', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Section>

          <TextField
            label="Remarks (optional)"
            value={form.remarks ?? ''}
            onChange={(e) => set('remarks', e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Save correction'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
