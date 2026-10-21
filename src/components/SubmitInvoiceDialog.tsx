import { useMemo, useState } from 'react';
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
  Chip,
  InputAdornment,
  IconButton,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Add, DeleteOutline, AttachFile } from '@mui/icons-material';
import { invoicesApi, workOrdersApi, documentsApi, type SubmitInvoiceBody, type ListParams, type ExtractedDocumentFields } from '@/api/endpoints';
import { UploadDocumentButton } from '@/components/UploadDocumentButton';
import { DocumentAutocomplete, type DocumentPickerOption } from '@/components/DocumentAutocomplete';
import { errorMessage } from '@/api/client';
import { currency, date } from '@/lib/format';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SCHEDULE_BLURB: Record<string, string> = {
  Monthly: 'monthly — capture the year and month this invoice bills.',
  Quarterly: 'quarterly — capture the year and quarter this invoice bills.',
  Yearly: 'yearly — capture the year this invoice bills.',
  Milestone: 'against milestones — pick the milestone this invoice claims.',
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * A vendor's claim against a published work order — a single invoice (base) amount and the
 * GST charged on it. The GST is split into CGST/SGST or IGST server-side, and the claim is
 * checked against the order's remaining billable balance on submit, so an over-claim is
 * refused there rather than silently accepted.
 */
export function SubmitInvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    workOrderId: '',
    vendorInvoiceNumber: '',
    vendorInvoiceDate: today(),
  });
  const [baseAmount, setBaseAmount] = useState<number | ''>('');
  const [gstAmount, setGstAmount] = useState<number | ''>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Supporting documents — a vendor or creator may attach any number of named files
  // (e.g. delivery challan, inspection note) alongside the invoice itself.
  const [documents, setDocuments] = useState<{ description: string; file: File | null }[]>([]);
  const addDocument = () => setDocuments((d) => [...d, { description: '', file: null }]);
  const setDocument = (i: number, patch: Partial<{ description: string; file: File | null }>) =>
    setDocuments((d) => d.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeDocument = (i: number) => setDocuments((d) => d.filter((_, idx) => idx !== i));

  // Billing period / milestone capture, driven by the selected work order's schedule.
  const [billingYear, setBillingYear] = useState<number | ''>('');
  const [billingMonth, setBillingMonth] = useState<number | ''>(''); // month (monthly) or quarter-start month (quarterly)
  const [milestoneId, setMilestoneId] = useState('');

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Pre-fill from an uploaded invoice draft.
  const applyExtracted = (f: ExtractedDocumentFields) => {
    if (f.invoiceNumber) set('vendorInvoiceNumber', f.invoiceNumber);
    const d = f.signedDate || f.startDate;
    if (d) set('vendorInvoiceDate', d.slice(0, 10));
    // Work order dropdown: match the cited work order number.
    const ref = (f.workOrderNumber ?? f.contractReference)?.trim().toLowerCase();
    if (ref) {
      const wo = (workOrders.data?.items ?? []).find(
        (w) =>
          w.workOrderNumber.toLowerCase() === ref ||
          w.workOrderNumber.toLowerCase().includes(ref) ||
          ref.includes(w.workOrderNumber.toLowerCase())
      );
      if (wo) set('workOrderId', wo.id);
    }
    if (f.amount != null) setBaseAmount(f.amount);
  };

  // Published work orders are the ones a vendor may bill against.
  const workOrders = useQuery({
    queryKey: ['work-orders', 'billable'],
    queryFn: () => workOrdersApi.list({ status: 'Published', pageSize: 100 } as ListParams),
    enabled: open,
  });

  const workOrderOptions: DocumentPickerOption[] = (workOrders.data?.items ?? []).map((w) => ({
    id: w.id,
    primary: `${w.workOrderNumber} · ${w.title}`,
    secondary: w.vendorName,
    searchText: `${w.workOrderNumber} ${w.title} ${w.vendorName}`.toLowerCase(),
  }));

  const selectedWo = workOrders.data?.items.find((w) => w.id === form.workOrderId);
  const schedule = selectedWo?.paymentScheduleType ?? 'OneTime';

  // A milestone order's milestones live on the detail, not the list — fetch them on demand.
  const woDetail = useQuery({
    queryKey: ['work-order', form.workOrderId, 'detail'],
    queryFn: () => workOrdersApi.get(form.workOrderId),
    enabled: open && !!form.workOrderId && schedule === 'Milestone',
  });
  const pendingMilestones = (woDetail.data?.milestones ?? []).filter(
    (m) => !m.invoiceId && m.status !== 'Invoiced' && m.status !== 'Paid' && m.status !== 'Cancelled'
  );

  // Selecting the work order resets any period/milestone capture from a previous choice.
  const onSelectWorkOrder = (id: string) => {
    set('workOrderId', id);
    setMilestoneId('');
    setBillingMonth('');
    setBillingYear(new Date().getFullYear());
  };

  // Picking a milestone prefills the base amount with its fixed value.
  const onPickMilestone = (id: string) => {
    setMilestoneId(id);
    const m = pendingMilestones.find((x) => x.id === id);
    if (m) setBaseAmount(m.amount);
  };

  const totals = useMemo(() => {
    const base = Number(baseAmount) || 0;
    const gst = Number(gstAmount) || 0;
    return { base, gst, total: base + gst };
  }, [baseAmount, gstAmount]);

  // Only the fields the selected schedule calls for are sent (type is derived server-side).
  const scheduleFields: Partial<SubmitInvoiceBody> =
    schedule === 'Milestone'
      ? { milestoneId }
      : schedule === 'Monthly' || schedule === 'Quarterly'
        ? { billingYear: Number(billingYear), billingMonth: Number(billingMonth) }
        : schedule === 'Yearly'
          ? { billingYear: Number(billingYear) }
          : {};

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await invoicesApi.submit({
        ...form,
        ...scheduleFields,
        vendorInvoiceDate: new Date(form.vendorInvoiceDate).toISOString(),
        baseAmount: Number(baseAmount) || 0,
        gstAmount: Number(gstAmount) || 0,
      });
      if (uploadedFile) {
        try {
          await documentsApi.upload('Invoice', r.invoiceId, uploadedFile);
        } catch {
          /* attachment is best-effort */
        }
      }

      const named = documents.filter((d): d is { description: string; file: File } => !!d.file);
      const results = await Promise.allSettled(
        named.map((d) => documentsApi.upload('Invoice', r.invoiceId, d.file, d.description.trim() || undefined))
      );
      const failedCount = results.filter((x) => x.status === 'rejected').length;

      return { ...r, failedCount };
    },
    onSuccess: (r) => {
      dispatch(showToast({ message: `Invoice ${r.invoiceNumber} submitted for review.`, severity: 'success' }));
      if (r.failedCount > 0) {
        dispatch(
          showToast({
            message: `${r.failedCount} supporting document(s) failed to attach — add them from the invoice's Attachments section.`,
            severity: 'warning',
          })
        );
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  // The schedule dictates what must be captured before the invoice can be submitted.
  const scheduleValid =
    schedule === 'Monthly' || schedule === 'Quarterly'
      ? !!billingYear && !!billingMonth
      : schedule === 'Yearly'
        ? !!billingYear
        : schedule === 'Milestone'
          ? !!milestoneId
          : true;

  const valid =
    !!form.workOrderId &&
    form.vendorInvoiceNumber.trim().length > 0 &&
    Number(baseAmount) > 0 &&
    scheduleValid;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>New invoice</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <UploadDocumentButton onExtracted={applyExtracted} onFileSelected={setUploadedFile} label="Upload Invoice" />
          </Box>
          <DocumentAutocomplete
            options={workOrderOptions}
            label="Purchase Order / Work Order"
            value={form.workOrderId}
            onChange={(id) => onSelectWorkOrder(id ?? '')}
            required
            autoFocus
            loading={workOrders.isLoading}
            helperText={
              workOrders.data?.items.length === 0
                ? 'No published purchase orders / work orders to bill against.'
                : selectedWo
                  ? `Billable balance ${currency(selectedWo.billableBalance)} · bills ${
                      schedule === 'OneTime' ? 'one-time' : schedule.toLowerCase()
                    }`
                  : 'Search by number, title or vendor'
            }
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Your invoice number"
                value={form.vendorInvoiceNumber}
                onChange={(e) => set('vendorInvoiceNumber', e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Invoice date"
                type="date"
                value={form.vendorInvoiceDate}
                onChange={(e) => set('vendorInvoiceDate', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          {/* Billing period / milestone capture, per the work order's payment schedule. */}
          {selectedWo && schedule !== 'OneTime' && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                This purchase order / work order bills {SCHEDULE_BLURB[schedule]}
              </Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.25 }}>
                {schedule === 'Milestone' ? (
                  <Grid size={{ xs: 12, sm: 7 }}>
                    <TextField
                      select
                      label="Milestone"
                      value={milestoneId}
                      onChange={(e) => onPickMilestone(e.target.value)}
                      fullWidth
                      size="small"
                      helperText={
                        woDetail.isLoading
                          ? 'Loading milestones…'
                          : pendingMilestones.length === 0
                            ? 'All milestones on this order have already been invoiced.'
                            : 'Billable on or after its due date'
                      }
                    >
                      {pendingMilestones.map((m) => (
                        <MenuItem key={m.id} value={m.id}>
                          {m.name} · {currency(m.amount)}
                          {m.dueDate ? ` · due ${date(m.dueDate)}` : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                ) : (
                  <>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <TextField
                        label="Year"
                        type="number"
                        value={billingYear}
                        onChange={(e) => setBillingYear(e.target.value ? Number(e.target.value) : '')}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    {schedule === 'Monthly' && (
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          select
                          label="Month"
                          value={billingMonth}
                          onChange={(e) => setBillingMonth(Number(e.target.value))}
                          fullWidth
                          size="small"
                        >
                          {MONTHS.map((mn, idx) => (
                            <MenuItem key={mn} value={idx + 1}>
                              {mn}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                    )}
                    {schedule === 'Quarterly' && (
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          select
                          label="Quarter"
                          value={billingMonth}
                          onChange={(e) => setBillingMonth(Number(e.target.value))}
                          fullWidth
                          size="small"
                        >
                          <MenuItem value={1}>Q1 (Jan–Mar)</MenuItem>
                          <MenuItem value={4}>Q2 (Apr–Jun)</MenuItem>
                          <MenuItem value={7}>Q3 (Jul–Sep)</MenuItem>
                          <MenuItem value={10}>Q4 (Oct–Dec)</MenuItem>
                        </TextField>
                      </Grid>
                    )}
                  </>
                )}
              </Grid>
            </Box>
          )}

          <Divider>
            <Chip label="Amount" size="small" />
          </Divider>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Invoice amount (base)"
                type="number"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                required
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                helperText="Taxable value, before GST"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="GST amount"
                type="number"
                value={gstAmount}
                onChange={(e) => setGstAmount(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                helperText="Split into CGST/SGST or IGST automatically"
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={3} justifyContent="flex-end" sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Base {currency(totals.base)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              GST {currency(totals.gst)}
            </Typography>
            <Typography variant="body2" fontWeight={700}>
              Gross {currency(totals.total)}
            </Typography>
          </Stack>

          <Divider>
            <Chip label="Supporting documents (optional)" size="small" />
          </Divider>

          <Stack spacing={1.25}>
            {documents.map((d, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Document name"
                  placeholder="e.g. Delivery challan"
                  value={d.description}
                  onChange={(e) => setDocument(i, { description: e.target.value })}
                  fullWidth
                  size="small"
                />
                <Button
                  component="label"
                  size="small"
                  variant="outlined"
                  startIcon={<AttachFile fontSize="small" />}
                  sx={{ flexShrink: 0, minWidth: 160 }}
                >
                  {d.file ? d.file.name : 'Choose file'}
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(e) => setDocument(i, { file: e.target.files?.[0] ?? null })}
                  />
                </Button>
                <IconButton size="small" color="error" onClick={() => removeDocument(i)}>
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Button startIcon={<Add />} onClick={addDocument} sx={{ alignSelf: 'flex-start' }}>
              Add more
            </Button>
          </Stack>

          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Submitting…' : 'Submit invoice'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
