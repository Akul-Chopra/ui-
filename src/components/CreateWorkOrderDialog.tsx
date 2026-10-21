import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Box,
  Divider,
  Paper,
  IconButton,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Gavel, Add, Delete, DeleteOutline } from '@mui/icons-material';
import {
  workOrdersApi,
  contractsApi,
  documentsApi,
  type CreateWorkOrderBody,
  type CreateWorkOrderMilestone,
  type PaymentScheduleType,
  type ContractSlaInput,
  type ListParams,
  type ExtractedDocumentFields,
} from '@/api/endpoints';
import { UploadDocumentButton } from '@/components/UploadDocumentButton';
import { DocumentAutocomplete, type DocumentPickerOption } from '@/components/DocumentAutocomplete';
import { matchByName, SECURITY_INSTRUMENT_OPTIONS } from '@/components/CreateContractDialog';
import { errorMessage } from '@/api/client';
import { currency } from '@/lib/format';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';
import { useLookups, useActiveVendors } from '@/lib/useLookups';
import { useAuth } from '@/lib/useAuth';
import { RoleCodes } from '@/lib/permissions';

const today = () => new Date().toISOString().slice(0, 10);
const inThreeMonths = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
};

/**
 * Raises a government work order, laid out in the standard public-sector format: agency
 * header, vendor particulars, scope and deliverables, financial terms, and authorisation.
 *
 * A work order is prepared by a NeGD official (the create permission is government-only) and
 * takes effect only through the rule-decided approval workflow — the "sign-off" is the
 * approval chain, not a field on this form. Line-item tax is computed server-side, and
 * whether a contract must be cited is a rule-engine decision taken at the resulting value.
 */
export function CreateWorkOrderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const lookups = useLookups(open);
  const vendors = useActiveVendors(open);

  const [form, setForm] = useState<Omit<CreateWorkOrderBody, 'lineItems'>>({
    title: '',
    vendorId: '',
    departmentId: '',
    startDate: today(),
    expectedCompletionDate: inThreeMonths(),
    deliveryLocation: '',
    scopeOfWork: '',
  });
  const [amount, setAmount] = useState(0);
  const [paymentScheduleType, setPaymentScheduleType] = useState<PaymentScheduleType>('OneTime');
  const [amountType, setAmountType] = useState<'' | 'TenderedValue' | 'AverageValue'>('');
  const [milestones, setMilestones] = useState<CreateWorkOrderMilestone[]>([]);
  const [slas, setSlas] = useState<ContractSlaInput[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const addMilestone = () => setMilestones((m) => [...m, { name: '', amount: 0, dueDate: '' }]);
  const setMilestone = (i: number, patch: Partial<CreateWorkOrderMilestone>) =>
    setMilestones((m) => m.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeMilestone = (i: number) => setMilestones((m) => m.filter((_, idx) => idx !== i));
  const milestoneTotal = milestones.reduce((s, m) => s + (m.amount || 0), 0);

  const addSla = () =>
    setSlas((xs) => [
      ...xs,
      { metric: '', measurementPeriod: 'Monthly', targetValue: '', deductionType: 'Percentage', deductionValue: 0, penaltyPeriod: 'Monthly' },
    ]);
  const setSla = (i: number, patch: Partial<ContractSlaInput>) =>
    setSlas((xs) => xs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const removeSla = (i: number) => setSlas((xs) => xs.filter((_, idx) => idx !== i));
  // A contract number pulled from a draft, matched to a dropdown option once that vendor's
  // contracts have loaded (the list is fetched only after the vendor is chosen).
  const [pendingContractRef, setPendingContractRef] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Pre-fill from an uploaded draft — including the Vendor and Reference-contract dropdowns.
  const applyExtracted = (f: ExtractedDocumentFields) => {
    setForm((prev) => {
      const next: typeof prev = {
        ...prev,
        title: f.title || prev.title,
        scopeOfWork: f.scopeOfWork ?? prev.scopeOfWork,
        startDate: f.startDate ? f.startDate.slice(0, 10) : prev.startDate,
        expectedCompletionDate: f.endDate ? f.endDate.slice(0, 10) : prev.expectedCompletionDate,
        deliveryLocation: f.deliveryLocation ?? prev.deliveryLocation,
        workOrderNumber: f.workOrderNumber ?? prev.workOrderNumber,
        termsAndConditions: f.paymentTerms ?? f.termsAndConditions ?? prev.termsAndConditions,
      };
      // Vendor: match on GSTIN (surest), else on a name contained in the legal name.
      const vname = f.vendorName?.trim().toLowerCase();
      const vendor = (vendors.data?.items ?? []).find(
        (v) => (f.gstin && v.gstin === f.gstin) || (vname && v.legalName.toLowerCase().includes(vname))
      );
      if (vendor) {
        next.vendorId = vendor.id;
        next.contractId = undefined; // its contracts reload; the effect below re-selects
      }
      // Department (issuing office) dropdown, matched to the master by name — a
      // department-scoped Creator stays locked to their own department instead.
      if (!isDepartmentScopedCreator) {
        next.departmentId = matchByName(lookups.data?.departments, f.department) ?? next.departmentId;
      }
      return next;
    });
    if (f.amount != null) setAmount(f.amount);
    if (f.contractReference) setPendingContractRef(f.contractReference.trim());
  };

  // Contracts for the chosen vendor, offered as the governing/reference contract. A work
  // order may draw against a contract that is Approved or Active — the two states the server
  // accepts — so we fetch the vendor's contracts and keep only those.
  const contracts = useQuery({
    queryKey: ['contracts', 'for-vendor', form.vendorId],
    queryFn: () => contractsApi.list({ vendorId: form.vendorId, pageSize: 100 } as ListParams),
    enabled: open && !!form.vendorId,
  });

  const drawableContracts = (contracts.data?.items ?? []).filter(
    (c) => c.status === 'Approved' || c.status === 'Active'
  );
  const pendingContracts = (contracts.data?.items ?? []).filter(
    (c) => c.status === 'Draft' || c.status === 'PendingApproval'
  );
  const contractOptions: DocumentPickerOption[] = [
    ...drawableContracts.map((c) => ({
      id: c.id,
      primary: `${c.contractNumber} · ${c.title}`,
      secondary: `${currency(c.availableValue)} available`,
      searchText: `${c.contractNumber} ${c.title}`.toLowerCase(),
    })),
    ...pendingContracts.map((c) => ({
      id: c.id,
      primary: `${c.contractNumber} · ${c.title}`,
      secondary: `${c.status} — approve first`,
      searchText: `${c.contractNumber} ${c.title}`.toLowerCase(),
      disabled: true,
    })),
  ];
  const selectedContract = drawableContracts.find((c) => c.id === form.contractId) ?? null;
  const selectedVendor = (vendors.data?.items ?? []).find((v) => v.id === form.vendorId) ?? null;
  const selectedDepartment = (lookups.data?.departments ?? []).find((d) => d.id === form.departmentId) ?? null;

  // A department-scoped Creator can only raise work orders for their own department (the
  // server enforces this too — see DEPARTMENT_MISMATCH), so their own department is the
  // only sensible default and it does not change once the list loads. Anyone else (a
  // tenant-wide Creator, an admin) still defaults to the first department, same as before.
  const isDepartmentScopedCreator = user?.roles?.includes(RoleCodes.Creator) && !!user?.departmentId;

  useEffect(() => {
    if (!form.departmentId && lookups.data?.departments?.length) {
      const own = isDepartmentScopedCreator
        ? lookups.data.departments.find((d) => d.id === user!.departmentId)
        : null;
      set('departmentId', own?.id ?? lookups.data.departments[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookups.data]);

  // Once the chosen vendor's contracts arrive, select the one the draft cited (by number).
  useEffect(() => {
    if (!pendingContractRef) return;
    const ref = pendingContractRef.toLowerCase();
    const match = drawableContracts.find(
      (c) =>
        c.contractNumber.toLowerCase() === ref ||
        c.contractNumber.toLowerCase().includes(ref) ||
        ref.includes(c.contractNumber.toLowerCase())
    );
    if (match) {
      set('contractId', match.id);
      setPendingContractRef(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingContractRef, contracts.data]);

  // A work order now carries a single lump-sum amount rather than itemised deliverables.
  // The server model still takes line items, so the amount is sent as one line (no GST split).
  const totals = { base: amount, tax: 0, total: amount };

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await workOrdersApi.create({
        ...form,
        workOrderNumber: form.workOrderNumber?.trim() || undefined,
        contractId: form.contractId || undefined,
        deliveryLocation: form.deliveryLocation || undefined,
        scopeOfWork: form.scopeOfWork || undefined,
        termsAndConditions: form.termsAndConditions?.trim() || undefined,
        startDate: new Date(form.startDate).toISOString(),
        expectedCompletionDate: new Date(form.expectedCompletionDate).toISOString(),
        amountType: amountType || undefined,
        paymentScheduleType,
        milestones:
          paymentScheduleType === 'Milestone'
            ? milestones.map((m) => ({
                name: m.name.trim(),
                amount: m.amount,
                dueDate: m.dueDate ? new Date(m.dueDate).toISOString() : undefined,
              }))
            : undefined,
        // SLAs apply only to an order that stands alone; a contract-backed order inherits the
        // contract's, so they are not sent when a reference contract is chosen.
        slas: form.contractId ? undefined : slas.filter((s) => s.metric.trim().length > 0),
        lineItems: [
          {
            itemDescription: form.title.trim() || 'Purchase order / work order amount',
            quantity: 1,
            unitOfMeasure: 'LS',
            unitPrice: amount,
            gstRate: 0,
          },
        ],
      });
      if (uploadedFile) {
        try {
          await documentsApi.upload('WorkOrder', r.workOrderId, uploadedFile);
        } catch {
          /* attachment is best-effort */
        }
      }
      return r;
    },
    onSuccess: (r) => {
      dispatch(
        showToast({
          message: `Purchase order / work order ${r.workOrderNumber} drafted — ${currency(r.totalAmount)}${
            r.contractWasRequired ? ' (contract required)' : ''
          }.`,
          severity: 'success',
        })
      );
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  // A milestone schedule needs at least one fully-specified milestone whose amounts add up
  // to the order value (a rupee of slack for rounding, matching the server's tolerance).
  const milestonesValid =
    paymentScheduleType !== 'Milestone' ||
    (milestones.length > 0 &&
      milestones.every((m) => m.name.trim().length > 0 && m.amount > 0) &&
      Math.abs(milestoneTotal - amount) <= 1);

  const valid =
    form.title.trim().length > 0 &&
    !!form.vendorId &&
    !!form.departmentId &&
    amount > 0 &&
    milestonesValid;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      // Mandatory fields: their asterisk in red, so what must be filled stands out.
      sx={{ '& .MuiFormLabel-asterisk': { color: 'error.main' } }}
    >
      <DialogTitle>New Purchase Order / Work Order</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <UploadDocumentButton onExtracted={applyExtracted} onFileSelected={setUploadedFile} label="Upload Purchase Order / Work Order" />
          </Box>

          {/* 1 — Header & Agency Information */}
          <SectionHeader n="1" title="Header & Agency Information" />
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
            <Grid container spacing={1.5}>
              <ReadFact label="Issuing agency" value={selectedDepartment?.name ?? '— select department —'} />
              <ReadFact label="Purchase Order / Work Order No." value={form.workOrderNumber?.trim() || 'Auto-generated on save'} />
              <ReadFact label="Issue date" value="On approval" />
            </Grid>
          </Paper>

          {/* 2 — Vendor Information */}
          <SectionHeader n="2" title="Vendor Information" />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Vendor"
                value={form.vendorId}
                onChange={(e) => {
                  set('vendorId', e.target.value);
                  set('contractId', undefined);
                }}
                fullWidth
                required
              >
                {(vendors.data?.items ?? []).map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.legalName} · {v.vendorCode}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DocumentAutocomplete
                options={contractOptions}
                label="Reference contract (optional)"
                value={form.contractId ?? ''}
                emptyOptionLabel="Not Applicable"
                onChange={(id) => {
                  set('contractId', id);
                  // Auto-populate the work order title + issuing department from the contract —
                  // except for a department-scoped Creator, who stays locked to their own
                  // department regardless of which contract they cite (a contract from another
                  // department would otherwise flip the field to a department they cannot submit
                  // under, and the save would fail server-side with DEPARTMENT_MISMATCH).
                  const c = drawableContracts.find((x) => x.id === id);
                  if (c) {
                    set('title', c.title);
                    if (!isDepartmentScopedCreator) {
                      const dep = (lookups.data?.departments ?? []).find((d) => d.name === c.departmentName);
                      if (dep) set('departmentId', dep.id);
                    }
                  }
                }}
                disabled={!form.vendorId}
                loading={contracts.isLoading}
                helperText={
                  !form.vendorId
                    ? 'Select a vendor first.'
                    : contracts.isLoading
                      ? 'Loading contracts…'
                      : drawableContracts.length === 0 && pendingContracts.length > 0
                        ? 'This vendor’s contracts are still pending approval — approve one before it can be cited.'
                        : drawableContracts.length === 0
                          ? 'No approved contracts for this vendor. Required only above the rule threshold.'
                          : 'Required only if the rules demand it at this value.'
                }
              />
            </Grid>
          </Grid>
          {selectedVendor && (
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
              <Grid container spacing={1.5}>
                <ReadFact label="Vendor" value={selectedVendor.legalName} />
                <ReadFact label="GSTIN" value={selectedVendor.gstin} />
                <ReadFact label="PAN" value={selectedVendor.pan} />
                <ReadFact label="Authorised contact" value={selectedVendor.mobile} />
                <ReadFact label="Registered at" value={`${selectedVendor.city}, ${selectedVendor.state}`} />
              </Grid>
            </Paper>
          )}

          {/* 3 — Scope of Work & Deliverables */}
          <SectionHeader n="3" title="Scope of Work & Deliverables" />
          <TextField
            label="Work description"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            fullWidth
            required
            multiline
            minRows={2}
            helperText={form.contractId ? 'Pre-filled from the reference contract — editable.' : 'What the purchase order / work order is for.'}
          />
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Purchase Order / Work Order No."
                value={form.workOrderNumber ?? ''}
                onChange={(e) => set('workOrderNumber', e.target.value || undefined)}
                fullWidth
                placeholder="e.g. WO/DEPT/2026/001"
                helperText="If already issued — else auto-generated"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Purchase order / work order date"
                type="date"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Completion deadline"
                type="date"
                value={form.expectedCompletionDate}
                onChange={(e) => set('expectedCompletionDate', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                select
                label="Amount type"
                value={amountType}
                onChange={(e) => setAmountType(e.target.value as typeof amountType)}
                fullWidth
              >
                <MenuItem value="">
                  <em>—</em>
                </MenuItem>
                <MenuItem value="TenderedValue">Tendered Value</MenuItem>
                <MenuItem value="AverageValue">Average Value (e.g. electricity billing)</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Order amount (₹)"
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                fullWidth
                required
                helperText="Single lump-sum value"
              />
            </Grid>
          </Grid>

          {/* 4 — Financial & Payment Terms */}
          <SectionHeader n="4" title="Financial & Payment Terms" />
          <TextField
            label="Payment terms & conditions"
            value={form.termsAndConditions ?? ''}
            onChange={(e) => set('termsAndConditions', e.target.value)}
            fullWidth
            multiline
            minRows={3}
            placeholder="Milestone/stage payments, advance %, retention %, penalty/LD clauses, statutory deductions (TDS, GST withholding)…"
            helperText="Pre-filled from an uploaded draft where available — editable."
          />
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                Billing: submit cumulative bills with measurement sheets/logs to the designated authority.
                Payments are subject to statutory deductions (TDS, GST withholding) as per government rules.
              </Typography>
              <Typography variant="body2" fontWeight={800} sx={{ whiteSpace: 'nowrap' }}>
                Total {currency(totals.total)}
              </Typography>
            </Stack>
          </Paper>

          {/* Security deposit — collected here when the work-order workflow requires it. */}
          <Grid container spacing={1.5} alignItems="center">
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Security deposit (₹)"
                type="number"
                value={form.securityDepositAmount ?? ''}
                onChange={(e) => set('securityDepositAmount', e.target.value ? Number(e.target.value) : undefined)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
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
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 4, sm: 2 }}>
              <TextField
                label="No."
                value={form.sdInstrumentNumber ?? ''}
                onChange={(e) => set('sdInstrumentNumber', e.target.value || undefined)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 4, sm: 2 }}>
              <TextField
                label="Date"
                type="date"
                value={form.sdInstrumentDate ?? ''}
                onChange={(e) => set('sdInstrumentDate', e.target.value || undefined)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 4, sm: 2 }}>
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

          {/* Payment schedule — how invoices will be generated against this order. */}
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  select
                  label="Payment schedule"
                  value={paymentScheduleType}
                  onChange={(e) => {
                    const v = e.target.value as PaymentScheduleType;
                    setPaymentScheduleType(v);
                    if (v !== 'Milestone') setMilestones([]);
                    else if (milestones.length === 0) setMilestones([{ name: '', amount: 0, dueDate: '' }]);
                  }}
                  fullWidth
                  size="small"
                  helperText="How invoices are generated"
                >
                  <MenuItem value="OneTime">One-time (single invoice)</MenuItem>
                  <MenuItem value="Monthly">Periodically — Monthly</MenuItem>
                  <MenuItem value="Quarterly">Periodically — Quarterly</MenuItem>
                  <MenuItem value="Yearly">Periodically — Yearly</MenuItem>
                  <MenuItem value="Milestone">Against milestones</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 8 }}>
                <Typography variant="caption" color="text.secondary">
                  {paymentScheduleType === 'OneTime' &&
                    'A single invoice will be raised for the whole order.'}
                  {paymentScheduleType === 'Monthly' &&
                    'One invoice per month; each invoice captures the year and month it bills.'}
                  {paymentScheduleType === 'Quarterly' &&
                    'One invoice per quarter; each invoice captures the year and quarter it bills.'}
                  {paymentScheduleType === 'Yearly' &&
                    'One invoice per year; each invoice captures the year it bills.'}
                  {paymentScheduleType === 'Milestone' &&
                    'One invoice per milestone, billable on or after its due date. The milestone amounts must sum to the order value.'}
                </Typography>
              </Grid>
            </Grid>

            {paymentScheduleType === 'Milestone' && (
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {milestones.map((m, i) => (
                  <Grid container spacing={1} key={i} alignItems="center">
                    <Grid size={{ xs: 12, sm: 5 }}>
                      <TextField
                        label={`Milestone ${i + 1}`}
                        value={m.name}
                        onChange={(e) => setMilestone(i, { name: e.target.value })}
                        fullWidth
                        required
                        size="small"
                        placeholder="e.g. Resource 1 deployed"
                      />
                    </Grid>
                    <Grid size={{ xs: 5, sm: 3 }}>
                      <TextField
                        label="Amount (₹)"
                        type="number"
                        value={m.amount || ''}
                        onChange={(e) => setMilestone(i, { amount: Number(e.target.value) })}
                        fullWidth
                        required
                        size="small"
                      />
                    </Grid>
                    <Grid size={{ xs: 5, sm: 3 }}>
                      <TextField
                        label="Due date"
                        type="date"
                        value={m.dueDate ?? ''}
                        onChange={(e) => setMilestone(i, { dueDate: e.target.value || undefined })}
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid size={{ xs: 2, sm: 1 }}>
                      <IconButton
                        onClick={() => removeMilestone(i)}
                        size="small"
                        disabled={milestones.length === 1}
                        aria-label="Remove milestone"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Grid>
                  </Grid>
                ))}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Button startIcon={<Add />} onClick={addMilestone} size="small">
                    Add milestone
                  </Button>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color={Math.abs(milestoneTotal - amount) > 1 ? 'error.main' : 'success.main'}
                  >
                    Milestones total {currency(milestoneTotal)} of {currency(amount)}
                  </Typography>
                </Stack>
              </Stack>
            )}
          </Paper>

          {selectedContract && totals.total > selectedContract.availableValue && (
            <Alert severity="warning">
              This order is {currency(totals.total)}, but {selectedContract.contractNumber} has only{' '}
              {currency(selectedContract.availableValue)} available. Reduce the order, or draw against a
              larger approved contract.
            </Alert>
          )}

          {/* Service Levels (SLA) — only for an order that stands alone. A contract-backed
              order inherits the contract's SLAs, so this section is hidden then. */}
          {!form.contractId && (
            <>
              <SectionHeader n="5" title="Service Levels (SLA)" />
              <Typography variant="caption" color="text.secondary">
                This purchase order / work order is not linked to a contract, so define its service levels here — measurable
                commitments and the deduction if breached, e.g. “Server uptime 99% in a month”, Monthly, 2%.
              </Typography>
              {slas.map((s, i) => (
                <Box key={i} sx={{ p: 1.5, border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 1.5 }}>
                  <Stack spacing={1.5}>
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Metric"
                          value={s.metric}
                          onChange={(e) => setSla(i, { metric: e.target.value })}
                          fullWidth
                          size="small"
                          placeholder="Server uptime 99% in a month"
                        />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          select
                          label="Measured"
                          value={s.measurementPeriod}
                          onChange={(e) => setSla(i, { measurementPeriod: e.target.value as ContractSlaInput['measurementPeriod'] })}
                          fullWidth
                          size="small"
                        >
                          {(['Days', 'Weekly', 'Monthly', 'Yearly'] as const).map((p) => (
                            <MenuItem key={p} value={p}>
                              {p}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 5, sm: 2 }}>
                        <TextField
                          label="Target"
                          value={s.targetValue ?? ''}
                          onChange={(e) => setSla(i, { targetValue: e.target.value })}
                          fullWidth
                          size="small"
                          placeholder="99%"
                        />
                      </Grid>
                      <Grid size={{ xs: 1, sm: 1 }} sx={{ textAlign: 'right' }}>
                        <IconButton size="small" color="error" onClick={() => removeSla(i)} aria-label="Remove SLA">
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Grid>
                    </Grid>

                    <TextField
                      label="Failure condition / bands"
                      value={s.failureCondition ?? ''}
                      onChange={(e) => setSla(i, { failureCondition: e.target.value })}
                      fullWidth
                      size="small"
                      placeholder="e.g. if fulfilled only 95% → apply the shortfall penalty"
                    />

                    <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'action.hover' }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        Penalty on breach
                      </Typography>
                      <Grid container spacing={1.5} alignItems="center" sx={{ mt: 0.25 }}>
                        <Grid size={{ xs: 6, sm: 4 }}>
                          <TextField
                            select
                            label="Type"
                            value={s.deductionType}
                            onChange={(e) => setSla(i, { deductionType: e.target.value as ContractSlaInput['deductionType'] })}
                            fullWidth
                            size="small"
                          >
                            <MenuItem value="Percentage">Percentage (%)</MenuItem>
                            <MenuItem value="FixedAmount">Fixed amount (₹)</MenuItem>
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>
                          <TextField
                            label={s.deductionType === 'Percentage' ? 'Deduction %' : 'Deduction ₹'}
                            type="number"
                            value={s.deductionValue || ''}
                            onChange={(e) => setSla(i, { deductionValue: Number(e.target.value) })}
                            fullWidth
                            size="small"
                            placeholder={s.deductionType === 'Percentage' ? '3' : '5000'}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            select
                            label="Applied every"
                            value={s.penaltyPeriod}
                            onChange={(e) => setSla(i, { penaltyPeriod: e.target.value as ContractSlaInput['penaltyPeriod'] })}
                            fullWidth
                            size="small"
                            helperText="How often the deduction recurs"
                          >
                            <MenuItem value="Days">Daily</MenuItem>
                            <MenuItem value="Weekly">Weekly</MenuItem>
                            <MenuItem value="Monthly">Monthly</MenuItem>
                            <MenuItem value="Yearly">Yearly</MenuItem>
                          </TextField>
                        </Grid>
                      </Grid>
                    </Box>
                  </Stack>
                </Box>
              ))}
              <Button startIcon={<Add />} onClick={addSla} sx={{ alignSelf: 'flex-start' }}>
                Add SLA
              </Button>
            </>
          )}

          {/* Authorisation */}
          <SectionHeader n={form.contractId ? '5' : '6'} title="Authorisation" />
          <Alert severity="info" icon={<Gavel />}>
            Prepared by <b>{user?.fullName ?? 'NeGD official'}</b>. On submission this purchase order / work order is authorised
            through the rule-decided approval workflow; the vendor accepts it when it is published to them.
          </Alert>

          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Creating…' : 'Create draft'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** A numbered section divider in the government-form layout. */
function SectionHeader({ n, title }: { n: string; title: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          width: 22,
          height: 22,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {n}
      </Box>
      <Typography variant="subtitle2" fontWeight={800}>
        {title}
      </Typography>
      <Divider sx={{ flex: 1 }} />
    </Stack>
  );
}

/** A read-only labelled fact in a header/vendor panel. */
function ReadFact({ label, value }: { label: string; value: string }) {
  return (
    <Grid size={{ xs: 6, sm: 4 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Grid>
  );
}
