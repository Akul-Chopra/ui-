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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { AttachFile, ExpandMore, Add, DeleteOutline } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { contractsApi, documentsApi, type CreateContractBody, type ContractSlaInput, type ExtractedDocumentFields } from '@/api/endpoints';
import { UploadDocumentButton } from '@/components/UploadDocumentButton';
import { ApprovalRoutingPicker, type RoutingChoice } from '@/components/ApprovalRoutingPicker';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';
import { useLookups, useActiveVendors } from '@/lib/useLookups';

const today = () => new Date().toISOString().slice(0, 10);
const inOneYear = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Security-deposit instrument choices, shared with the Work Order form — both a contract
 * and a work order can hold a security deposit against the same `sd_instrument_type` column.
 */
export const SECURITY_INSTRUMENT_OPTIONS = [
  { value: 'PerformanceBankGuarantee', label: 'Performance Bank Guarantee (PBG)' },
  { value: 'DemandDraft', label: 'Demand Draft' },
  { value: 'RtgsNeft', label: 'RTGS / NEFT' },
  { value: 'FixedDepositReceipt', label: 'Fixed Deposit Receipt (FDR)' },
  { value: 'InsuranceSurety', label: 'Insurance Surety' },
  { value: 'ElectronicPerformanceBankGuarantee', label: 'Electronic PBG (ePBG)' },
  { value: 'IndemnityBond', label: 'Indemnity Bond' },
] as const;

/** Finds the catalogue option whose name matches an extracted string, and returns its id. */
export function matchByName(
  list: ReadonlyArray<{ id: string; name: string }> | undefined,
  extracted: string | null | undefined
): string | undefined {
  const e = extracted?.trim().toLowerCase();
  if (!e) return undefined;
  const opt =
    list?.find((x) => x.name.toLowerCase() === e) ??
    list?.find((x) => x.name.toLowerCase().includes(e) || e.includes(x.name.toLowerCase()));
  return opt?.id;
}

/** Maps a free-text period to the SLA grid's allowed values. */
function normalizePeriod(v: string | null | undefined): ContractSlaInput['measurementPeriod'] {
  const s = v?.toLowerCase() ?? '';
  if (s.includes('day')) return 'Days';
  if (s.includes('week')) return 'Weekly';
  if (s.includes('year') || s.includes('annual')) return 'Yearly';
  return 'Monthly';
}

/**
 * Drafts a government vendor contract, laid out in its standard collapsible sections: the
 * parties and purpose, the scope of work, cost and payment, the term/termination and legal
 * clauses, and the service levels. A contract is owned by its Vertical/Section. The draft is
 * editable and starts no approval until it is submitted; the signed file is attached afterwards
 * from the contract's detail panel, where every reviewer along the workflow can see it.
 */
export function CreateContractDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lookups = useLookups(open);
  const vendors = useActiveVendors(open);

  const [form, setForm] = useState<CreateContractBody>({
    title: '',
    vendorId: '',
    contractValue: 0,
    startDate: today(),
    endDate: inOneYear(),
    isRenewable: false,
    slas: [],
  });

  const set = <K extends keyof CreateContractBody>(key: K, value: CreateContractBody[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Pre-fill from an uploaded draft — only overwrite fields the extractor actually found.
  const applyExtracted = (f: ExtractedDocumentFields) =>
    setForm((prev) => {
      const next = {
        ...prev,
        title: f.title || prev.title,
        description: f.description ?? prev.description,
        scopeOfWork: f.scopeOfWork ?? prev.scopeOfWork,
        paymentTerms: f.paymentTerms ?? prev.paymentTerms,
        termsAndConditions: f.termsAndConditions ?? prev.termsAndConditions,
        complianceTerms: f.complianceTerms ?? prev.complianceTerms,
        indemnificationTerms: f.indemnificationTerms ?? prev.indemnificationTerms,
        disputeResolution: f.disputeResolution ?? prev.disputeResolution,
        contractValue: f.amount ?? prev.contractValue,
        startDate: f.startDate ? f.startDate.slice(0, 10) : prev.startDate,
        endDate: f.endDate ? f.endDate.slice(0, 10) : prev.endDate,
        signedDate: f.signedDate ? f.signedDate.slice(0, 10) : prev.signedDate,
      };
      // Vendor dropdown: match on GSTIN (surest), else a name contained in the legal name.
      const vname = f.vendorName?.trim().toLowerCase();
      const vendor = (vendors.data?.items ?? []).find(
        (v) => (f.gstin && v.gstin === f.gstin) || (vname && v.legalName.toLowerCase().includes(vname))
      );
      if (vendor) next.vendorId = vendor.id;

      // Master-backed dropdowns: match the extracted text to a catalogue option by name.
      const lk = lookups.data;
      next.verticalId = matchByName(lk?.verticals, f.vertical) ?? next.verticalId;
      next.contractCategoryId = matchByName(lk?.contractCategories, f.category) ?? next.contractCategoryId;
      next.contractSelectionModeId =
        matchByName(lk?.contractSelectionModes, f.contractSelectionMode) ?? next.contractSelectionModeId;
      next.contractForId = matchByName(lk?.contractFors, f.contractFor) ?? next.contractForId;

      // Service-level rows, mapped onto the SLA grid.
      if (f.slas && f.slas.length > 0) {
        next.slas = f.slas.map((s) => ({
          metric: s.metric ?? '',
          measurementPeriod: normalizePeriod(s.measurementPeriod),
          targetValue: s.targetValue ?? undefined,
          failureCondition: s.failureCondition ?? undefined,
          deductionType: s.deductionType?.toLowerCase().includes('fix') ? 'FixedAmount' : 'Percentage',
          deductionValue: s.deductionValue ?? 0,
          penaltyPeriod: normalizePeriod(s.penaltyPeriod ?? s.measurementPeriod),
        }));
      }
      return next;
    });

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [routingMode, setRoutingMode] = useState<RoutingChoice>('Default');
  const [firstApproverId, setFirstApproverId] = useState('');

  const slas = form.slas ?? [];
  const addSla = () =>
    setForm((f) => ({
      ...f,
      slas: [
        ...(f.slas ?? []),
        { metric: '', measurementPeriod: 'Monthly', deductionType: 'Percentage', deductionValue: 0, penaltyPeriod: 'Monthly' },
      ],
    }));
  const setSla = (i: number, patch: Partial<ContractSlaInput>) =>
    setForm((f) => ({ ...f, slas: (f.slas ?? []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  const removeSla = (i: number) =>
    setForm((f) => ({ ...f, slas: (f.slas ?? []).filter((_, idx) => idx !== i) }));

  const mutation = useMutation({
    mutationFn: async (submit: boolean) => {
      const r = await contractsApi.create({
        ...form,
        contractCategoryId: form.contractCategoryId || undefined,
        // Only keep the free-text purpose when "Other" is chosen.
        contractForOther: isOtherContractFor ? form.contractForOther?.trim() || undefined : undefined,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        signedDate: form.signedDate ? new Date(form.signedDate).toISOString() : undefined,
        slas: (form.slas ?? []).filter((s) => s.metric.trim().length > 0),
      });
      // Attach the uploaded draft to the new contract so it lives in its documents.
      if (uploadedFile) {
        try {
          await documentsApi.upload('Contract', r.contractId, uploadedFile);
        } catch {
          /* attachment is best-effort; the contract is already created */
        }
      }
      if (submit)
        await contractsApi.submit(r.contractId, {
          routingMode: routingMode === 'Default' ? undefined : routingMode,
          firstApproverUserId: routingMode === 'Manual' ? firstApproverId : undefined,
        });
      return { ...r, submitted: submit };
    },
    onSuccess: (r) => {
      dispatch(
        showToast({
          message: r.submitted
            ? `Contract ${r.contractNumber} submitted for approval.`
            : `Contract ${r.contractNumber} drafted. Open it to attach the signed document.`,
          severity: 'success',
        })
      );
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  // A super user can hide the Cost & Payment section for a category (a master flag).
  const selectedCategory = (lookups.data?.contractCategories ?? []).find(
    (c) => c.id === form.contractCategoryId
  );
  const showCostPayment = selectedCategory?.showCostPaymentSection !== false;

  // "Contract For = Other" reveals a free-text purpose box.
  const selectedContractFor = (lookups.data?.contractFors ?? []).find((f) => f.id === form.contractForId);
  const isOtherContractFor = selectedContractFor?.name.trim().toLowerCase() === 'other';

  const valid =
    form.title.trim().length > 0 &&
    !!form.vendorId &&
    !!form.verticalId &&
    (!showCostPayment || form.contractValue > 0) &&
    (!isOtherContractFor || (form.contractForOther?.trim().length ?? 0) > 0) &&
    form.endDate >= form.startDate;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>New contract</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <UploadDocumentButton onExtracted={applyExtracted} onFileSelected={setUploadedFile} label="Upload Contract" />
          </Box>

          {/* 1 · Parties & Purpose */}
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
                  helperText={vendors.data?.items.length === 0 ? 'No active vendors — verify one first.' : ' '}
                >
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
                  required
                  helperText="The owning unit that raises and drives this contract."
                >
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
                    placeholder="e.g. Drone Survey Services"
                  />
                </Grid>
              )}
            </Grid>
          </Section>

          {/* 2 · Scope of Work */}
          <Section title="Scope of Work">
            <TextField
              label="Scope of work — goods, services, deliverables, performance rules (optional)"
              value={form.scopeOfWork ?? ''}
              onChange={(e) => set('scopeOfWork', e.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Section>

          {/* 3 · Cost & Payment — shown only for categories the super user has flagged for it. */}
          {showCostPayment && (
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
                          <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
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
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Upload the instrument document from the contract's Attachments section once it is created.
                  </Typography>
                </Box>
              )}
              <TextField
                label="Payment terms — due dates and invoicing steps (optional)"
                value={form.paymentTerms ?? ''}
                onChange={(e) => set('paymentTerms', e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
            </Section>
          )}

          {/* 4 · Contract Terms & Legal Clauses */}
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
                    placeholder="e.g. 3"
                  />
                </Grid>
              )}
            </Grid>
            <TextField
              label="General conditions — including early-termination rules (optional)"
              value={form.termsAndConditions ?? ''}
              onChange={(e) => set('termsAndConditions', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Compliance — laws and public-sector rules the vendor must follow (optional)"
              value={form.complianceTerms ?? ''}
              onChange={(e) => set('complianceTerms', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Indemnification — protection if the vendor causes harm or legal issues (optional)"
              value={form.indemnificationTerms ?? ''}
              onChange={(e) => set('indemnificationTerms', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Dispute resolution — how disputes and breaches are handled (optional)"
              value={form.disputeResolution ?? ''}
              onChange={(e) => set('disputeResolution', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Section>

          {/* 5 · Service Levels (SLA) — repeatable commitments and their breach deduction. */}
          <Section title="Service Levels (SLA)">
            <Typography variant="caption" color="text.secondary">
              Measurable commitments and the deduction if breached — e.g. “Server uptime 99% in a month”,
              Monthly, 2% deduction. (optional)
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
                      <IconButton size="small" color="error" onClick={() => removeSla(i)}>
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

                  {/* Penalty on breach: how much, of what kind, how often it recurs, and its cap. */}
                  <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                      Penalty on breach
                    </Typography>
                    <Grid container spacing={1.5} alignItems="flex-start" sx={{ mt: 0.25 }}>
                      <Grid size={{ xs: 6, sm: 3 }}>
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
                      <Grid size={{ xs: 6, sm: 3 }}>
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
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          select
                          label="Applied every"
                          value={s.penaltyPeriod}
                          onChange={(e) => setSla(i, { penaltyPeriod: e.target.value as ContractSlaInput['penaltyPeriod'] })}
                          fullWidth
                          size="small"
                        >
                          <MenuItem value="Days">Daily</MenuItem>
                          <MenuItem value="Weekly">Weekly</MenuItem>
                          <MenuItem value="Monthly">Monthly</MenuItem>
                          <MenuItem value="Yearly">Yearly</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          label="Cap %"
                          type="number"
                          value={s.penaltyCapPercentage ?? ''}
                          onChange={(e) =>
                            setSla(i, { penaltyCapPercentage: e.target.value === '' ? undefined : Number(e.target.value) })
                          }
                          fullWidth
                          size="small"
                          placeholder="10"
                          helperText="Upper limit"
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Stack>
              </Box>
            ))}
            <Button startIcon={<Add />} onClick={addSla} sx={{ alignSelf: 'flex-start' }}>
              Add SLA
            </Button>
          </Section>

          <ApprovalRoutingPicker
            open={open}
            routingMode={routingMode}
            onRoutingModeChange={setRoutingMode}
            firstApproverId={firstApproverId}
            onFirstApproverChange={setFirstApproverId}
            documentLabel="contract"
          />

          <Alert severity="info" icon={<AttachFile />}>
            After you create the draft, open the contract to attach the signed document and any
            annexures — they become visible to every approval officer along the workflow.
          </Alert>

          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="outlined"
          disabled={!valid || mutation.isPending}
          onClick={() => mutation.mutate(false)}
        >
          {mutation.isPending ? 'Working…' : 'Save as draft'}
        </Button>
        <Button
          variant="contained"
          disabled={!valid || mutation.isPending || (routingMode === 'Manual' && !firstApproverId)}
          onClick={() => mutation.mutate(true)}
        >
          {mutation.isPending ? 'Working…' : 'Save & submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** A collapsible, titled section — the building block of the contract form. */
export function Section({ title, defaultExpanded, children }: { title: string; defaultExpanded?: boolean; children: React.ReactNode }) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        border: (t) => `1px solid ${t.palette.divider}`,
        borderRadius: 1,
        '&:before': { display: 'none' },
        '&.Mui-expanded': { margin: 0 },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMore />} sx={{ '& .MuiAccordionSummary-content': { my: 1 } }}>
        <Typography variant="subtitle2" fontWeight={800}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>{children}</Stack>
      </AccordionDetails>
    </Accordion>
  );
}
