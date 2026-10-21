import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Alert,
  Typography,
  InputAdornment,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { invoicesApi } from '@/api/endpoints';
import type { InvoiceDetail } from '@/api/types';
import { errorMessage } from '@/api/client';
import { currency } from '@/lib/format';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

export type InvoiceCorrectionMode = 'correct' | 'resubmit';

/**
 * Edits an invoice's particulars for one of two situations that share the same fields:
 * - `resubmit`: a review returned it for clarification (status OnHold) — this restarts the
 *   approval from scratch.
 * - `correct`: the reviewer it is currently pending with found a mistake and fixes it
 *   themselves instead of returning it — the pending review is left untouched.
 * Either way, the purchase order / work order and billing period never change here — only
 * what was wrong needs fixing, not which claim this is.
 */
export function ResubmitInvoiceDialog({
  invoice,
  open,
  mode = 'resubmit',
  onClose,
}: {
  invoice: InvoiceDetail;
  open: boolean;
  mode?: InvoiceCorrectionMode;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const isCorrect = mode === 'correct';

  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState(invoice.vendorInvoiceNumber);
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState(invoice.vendorInvoiceDate.slice(0, 10));
  const [baseAmount, setBaseAmount] = useState<number | ''>(invoice.baseAmount);
  const [gstAmount, setGstAmount] = useState<number | ''>(invoice.totalTaxAmount);
  const [remarks, setRemarks] = useState('');

  const total = (Number(baseAmount) || 0) + (Number(gstAmount) || 0);

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        vendorInvoiceNumber,
        vendorInvoiceDate: new Date(vendorInvoiceDate).toISOString(),
        baseAmount: Number(baseAmount) || 0,
        gstAmount: Number(gstAmount) || 0,
        remarks: remarks.trim() || undefined,
      };
      return isCorrect ? invoicesApi.correct(invoice.id, body) : invoicesApi.resubmit(invoice.id, body);
    },
    onSuccess: () => {
      dispatch(
        showToast({
          message: isCorrect
            ? `${invoice.invoiceNumber} corrected — the pending review is unaffected.`
            : `${invoice.invoiceNumber} corrected and sent back for review.`,
          severity: 'success',
        })
      );
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const valid =
    vendorInvoiceNumber.trim().length > 0 &&
    Number(baseAmount) > 0 &&
    (isCorrect || remarks.trim().length > 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isCorrect ? 'Correct' : 'Correct & resubmit'} {invoice.invoiceNumber}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {isCorrect
              ? "Fix a mistake before you decide this invoice — the pending review stays exactly where it is; nothing restarts."
              : 'Fix what the reviewer flagged, then send it back — this restarts the approval from the ' +
                'beginning.'}{' '}
            The purchase order / work order and billing period stay the same.
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Your invoice number"
                value={vendorInvoiceNumber}
                onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Invoice date"
                type="date"
                value={vendorInvoiceDate}
                onChange={(e) => setVendorInvoiceDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Invoice amount (base)"
                type="number"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value ? Number(e.target.value) : '')}
                fullWidth
                required
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
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
              />
            </Grid>
          </Grid>

          <Typography variant="body2" fontWeight={700} textAlign="right">
            Gross {currency(total)}
          </Typography>

          <TextField
            label={isCorrect ? 'What was corrected (optional)' : 'What was corrected'}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            fullWidth
            required={!isCorrect}
            multiline
            minRows={2}
            helperText="Recorded on the audit trail."
          />

          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : isCorrect ? 'Save correction' : 'Resubmit for review'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
