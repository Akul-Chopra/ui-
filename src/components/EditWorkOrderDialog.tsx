import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Stack, Alert, Box } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { workOrdersApi, type UpdateWorkOrderBody } from '@/api/endpoints';
import type { WorkOrderDetail } from '@/api/types';
import { Section, SECURITY_INSTRUMENT_OPTIONS } from '@/components/CreateContractDialog';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';
import { useLookups, useActiveVendors } from '@/lib/useLookups';

const AMOUNT_TYPE_OPTIONS = [
  { value: 'TenderedValue', label: 'Tendered Value' },
  { value: 'AverageValue', label: 'Average Value (e.g. electricity billing)' },
] as const;

function toBody(w: WorkOrderDetail): UpdateWorkOrderBody {
  return {
    title: w.title,
    description: w.description,
    vendorId: w.vendorId,
    departmentId: w.departmentId,
    startDate: w.startDate.slice(0, 10),
    expectedCompletionDate: w.expectedCompletionDate.slice(0, 10),
    deliveryLocation: w.deliveryLocation,
    scopeOfWork: w.scopeOfWork,
    termsAndConditions: w.termsAndConditions,
    securityDepositAmount: w.securityDepositAmount,
    sdInstrumentType: w.sdInstrumentType,
    sdInstrumentNumber: w.sdInstrumentNumber,
    sdInstrumentDate: w.sdInstrumentDate?.slice(0, 10),
    sdInstrumentValidityDate: w.sdInstrumentValidityDate?.slice(0, 10),
    amountType: w.amountType as UpdateWorkOrderBody['amountType'],
    totalAmount: w.totalAmount,
    remarks: w.remarks,
  };
}

/**
 * Corrects a work order in place — the section Approver's (or an administrator's) tool for
 * fixing a mistake after the fact. Line items, milestones and the citing contract are out of
 * scope for this tool; only the order's own header fields, value and vendor may be corrected.
 * No versioning, no effect on the running or already-cleared approval.
 */
export function EditWorkOrderDialog({
  open,
  onClose,
  workOrder,
}: {
  open: boolean;
  onClose: () => void;
  workOrder: WorkOrderDetail;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lookups = useLookups(open);
  const vendors = useActiveVendors(open);

  const [form, setForm] = useState<UpdateWorkOrderBody>(() => toBody(workOrder));

  const set = <K extends keyof UpdateWorkOrderBody>(key: K, value: UpdateWorkOrderBody[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () =>
      workOrdersApi.update(workOrder.id, {
        ...form,
        startDate: new Date(form.startDate).toISOString(),
        expectedCompletionDate: new Date(form.expectedCompletionDate).toISOString(),
        sdInstrumentDate: form.sdInstrumentDate ? new Date(form.sdInstrumentDate).toISOString() : undefined,
        sdInstrumentValidityDate: form.sdInstrumentValidityDate
          ? new Date(form.sdInstrumentValidityDate).toISOString()
          : undefined,
      }),
    onSuccess: () => {
      dispatch(showToast({ message: `${workOrder.workOrderNumber} corrected.`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrder.id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const valid =
    form.title.trim().length > 0 &&
    !!form.vendorId &&
    !!form.departmentId &&
    form.totalAmount > 0 &&
    form.expectedCompletionDate >= form.startDate;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Correct {workOrder.workOrderNumber}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Alert severity="info">
            This corrects the purchase order / work order's own record. Line items, milestones and the citing
            contract are not changed here, and the approval already recorded against it is left
            untouched.
          </Alert>

          <Section title="Particulars" defaultExpanded>
            <TextField
              label="Title"
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
                  label="Vendor"
                  value={form.vendorId}
                  onChange={(e) => set('vendorId', e.target.value)}
                  fullWidth
                  required
                >
                  {!(vendors.data?.items ?? []).some((v) => v.id === workOrder.vendorId) && (
                    <MenuItem value={workOrder.vendorId}>{workOrder.vendorName} (current)</MenuItem>
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
                  label="Department"
                  value={form.departmentId}
                  onChange={(e) => set('departmentId', e.target.value)}
                  fullWidth
                  required
                >
                  {(lookups.data?.departments ?? []).map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 6, sm: 6 }}>
                <TextField
                  label="Start date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 6 }}>
                <TextField
                  label="Expected completion"
                  type="date"
                  value={form.expectedCompletionDate}
                  onChange={(e) => set('expectedCompletionDate', e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Delivery location (optional)"
                  value={form.deliveryLocation ?? ''}
                  onChange={(e) => set('deliveryLocation', e.target.value)}
                  fullWidth
                />
              </Grid>
            </Grid>
            <TextField
              label="Scope of work (optional)"
              value={form.scopeOfWork ?? ''}
              onChange={(e) => set('scopeOfWork', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Terms & conditions (optional)"
              value={form.termsAndConditions ?? ''}
              onChange={(e) => set('termsAndConditions', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Section>

          <Section title="Value" defaultExpanded>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Amount type (optional)"
                  value={form.amountType ?? ''}
                  onChange={(e) => set('amountType', (e.target.value || undefined) as UpdateWorkOrderBody['amountType'])}
                  fullWidth
                >
                  <MenuItem value="">
                    <em>Not specified</em>
                  </MenuItem>
                  {AMOUNT_TYPE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Purchase order / work order amount (₹)"
                  type="number"
                  value={form.totalAmount || ''}
                  onChange={(e) => set('totalAmount', Number(e.target.value))}
                  fullWidth
                  required
                  helperText="Base and tax are rescaled proportionally to this total."
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
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
                <Grid container spacing={1.5}>
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
