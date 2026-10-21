import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  MenuItem,
  Typography,
  Alert,
} from '@mui/material';
import { Payments } from '@mui/icons-material';
import { invoicesApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { currency } from '@/lib/format';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

const MODES = [
  { value: 'Neft', label: 'NEFT' },
  { value: 'Rtgs', label: 'RTGS' },
  { value: 'Imps', label: 'IMPS' },
  { value: 'Upi', label: 'UPI' },
  { value: 'Nach', label: 'NACH' },
  { value: 'Pfms', label: 'PFMS' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'DemandDraft', label: 'Demand Draft' },
];

const today = () => new Date().toISOString().slice(0, 10);
const isInstrument = (mode: string) => mode === 'Cheque' || mode === 'DemandDraft';

/**
 * The minimal invoice shape this dialog needs. Kept structural (rather than the full
 * InvoiceDetail) so the dialog can be opened from the invoice drawer and from the standalone
 * "Record Payment" list, which carry different-but-compatible invoice objects.
 */
export interface PayableInvoice {
  id: string;
  invoiceNumber: string;
  netPayableAmount: number;
  paidAmount: number;
}

/**
 * Manually records a payment against an invoice and marks it paid — the interim facility for
 * accounts / finance until the bank integration lands. Captures the mode, a reference (UTR or
 * cheque / DD number), the date and the amount; for a cheque or DD, the instrument date and
 * bank are captured too.
 */
export function RecordPaymentDialog({
  invoice,
  onClose,
}: {
  invoice: PayableInvoice | null;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const outstanding = invoice ? invoice.netPayableAmount - invoice.paidAmount : 0;

  const [mode, setMode] = useState('Neft');
  const [reference, setReference] = useState('');
  const [instrumentDate, setInstrumentDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [paymentDate, setPaymentDate] = useState(today());
  const [remarks, setRemarks] = useState('');

  // The payment always settles the full outstanding — the amount is not editable here.
  const amountValue = outstanding;

  const reset = () => {
    setMode('Neft');
    setReference('');
    setInstrumentDate('');
    setBankName('');
    setPaymentDate(today());
    setRemarks('');
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () =>
      invoicesApi.recordPayment(invoice!.id, {
        amount: amountValue,
        paymentMode: mode,
        referenceNumber: reference.trim(),
        instrumentDate: isInstrument(mode) && instrumentDate ? new Date(instrumentDate).toISOString() : undefined,
        bankName: isInstrument(mode) ? bankName.trim() || undefined : undefined,
        paymentDate: new Date(paymentDate).toISOString(),
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: () => {
      dispatch(showToast({ message: 'Payment recorded and invoice marked paid.', severity: 'success' }));
      const id = invoice!.id;
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id, 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payment-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      reset();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  if (!invoice) return null;

  const referenceLabel =
    mode === 'Cheque' ? 'Cheque number' : mode === 'DemandDraft' ? 'DD number' : 'UTR / reference number';
  const canSubmit =
    amountValue > 0 &&
    reference.trim().length > 0 &&
    (!isInstrument(mode) || instrumentDate.length > 0);

  return (
    <Dialog open onClose={reset} maxWidth="sm" fullWidth sx={{ zIndex: (t) => t.zIndex.modal + 2 }}>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Payments />
          <span>Record payment — {invoice.invoiceNumber}</span>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Net payable {currency(invoice.netPayableAmount)} · already paid {currency(invoice.paidAmount)} ·{' '}
            <b>outstanding {currency(outstanding)}</b>. Recording a payment marks the invoice paid (or partially paid).
          </Alert>

          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Payment mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              fullWidth
            >
              {MODES.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Amount"
              value={currency(outstanding)}
              fullWidth
              InputProps={{ readOnly: true }}
              helperText="Full outstanding amount — settled in one payment."
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label={referenceLabel}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              fullWidth
              required
              placeholder={mode === 'Cheque' || mode === 'DemandDraft' ? 'e.g. 004521' : 'e.g. SBIN0XXXXXXXX'}
            />
            <TextField
              label="Payment date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          {isInstrument(mode) && (
            <Stack direction="row" spacing={2}>
              <TextField
                label={mode === 'Cheque' ? 'Cheque date' : 'DD date'}
                type="date"
                value={instrumentDate}
                onChange={(e) => setInstrumentDate(e.target.value)}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                error={!instrumentDate}
              />
              <TextField
                label="Drawn on bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                fullWidth
                placeholder="e.g. State Bank of India"
              />
            </Stack>
          )}

          <TextField
            label="Remarks (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          <Typography variant="caption" color="text.secondary">
            The bank / PFMS integration will replace this manual step later; entries made here are flagged as
            manually recorded.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={reset} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" color="success" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Recording…' : 'Record payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
