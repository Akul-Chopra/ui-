import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { ngpsSanctionOrdersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { SanctionOrderSubmitResult } from '@/api/types';
import { currency } from '@/lib/format';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

/** Today's date in the browser's own time zone (YYYY-MM-DD); toISOString would give UTC's date. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Previews the Sanction Order exactly as NGPS will receive it — one row per beneficiary,
 * the order type, frequency and year — and every reason NGPS would refuse it, then sends it.
 * NGPS accepts or rejects an order as a whole, so nothing is sent while any check fails.
 */
export function SanctionOrderSubmitDialog({
  open,
  invoiceIds,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  invoiceIds: string[];
  onClose: () => void;
  onSubmitted: (result: SanctionOrderSubmitResult) => void;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [sanctionDate, setSanctionDate] = useState(today());

  useEffect(() => {
    if (open) {
      setDescription('');
      setSanctionDate(today());
    }
  }, [open]);

  const preview = useQuery({
    queryKey: ['ngps-sanction-preview', invoiceIds, sanctionDate],
    queryFn: () => ngpsSanctionOrdersApi.preview({ invoiceIds, sanctionDate }),
    enabled: open && invoiceIds.length > 0 && !!sanctionDate,
  });

  const submit = useMutation({
    mutationFn: () =>
      ngpsSanctionOrdersApi.create({
        invoiceIds,
        description: description.trim() || undefined,
        sanctionDate,
      }),
    onSuccess: (result) => {
      const severity = result.state === 'Accepted' ? 'success' : result.state === 'Rejected' ? 'error' : 'warning';
      const prefix =
        result.state === 'Accepted'
          ? `Sanction Order ${result.sanctionOrderNo} received by NGPS.`
          : result.state === 'Rejected'
            ? `NGPS rejected Sanction Order ${result.sanctionOrderNo}; its payments were released.`
            : `Sanction Order ${result.sanctionOrderNo} is awaiting NGPS confirmation.`;
      dispatch(showToast({ message: `${prefix} ${result.message}`, severity }));
      queryClient.invalidateQueries({ queryKey: ['ngps-sanction-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['ngps-sanction-orders'] });
      queryClient.invalidateQueries({ queryKey: ['payment-queue'] });
      onSubmitted(result);
    },
  });

  const close = () => {
    if (submit.isPending) return;
    submit.reset();
    onClose();
  };

  const p = preview.data;

  return (
    <Dialog open={open} onClose={close} maxWidth="lg" fullWidth>
      <DialogTitle>Send Sanction Order to NGPS</DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="Description (narration)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            inputProps={{ maxLength: 350 }}
            fullWidth
            size="small"
            placeholder="e.g. Vendor payments – October 2026"
          />
          <TextField
            label="Sanction date"
            type="date"
            value={sanctionDate}
            onChange={(e) => setSanctionDate(e.target.value)}
            inputProps={{ max: today() }}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ minWidth: 180 }}
          />
        </Stack>

        {preview.isLoading && (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {preview.isError && <Alert severity="error">{errorMessage(preview.error)}</Alert>}

        {p && (
          <>
            {p.errors.map((e) => (
              <Alert key={e} severity="error" sx={{ mb: 1 }}>
                {e}
              </Alert>
            ))}

            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>{p.totalBeneficiaries}</strong> beneficiaries · <strong>{currency(p.totalAmount)}</strong> ·{' '}
              {p.soType === 2 ? 'Re-process (SOType 2)' : 'New (SOType 1)'} · Frequency {p.frequencyValue} · Year {p.year}{' '}
              · Account-based (ACH)
            </Typography>

            <TableContainer sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Invoice</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Beneficiary</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Account · IFSC</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Amount
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Checks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {p.rows.map((r) => (
                    <TableRow key={r.invoiceId}>
                      <TableCell>
                        <Typography variant="body2">{r.portalReferenceNo}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID {r.beneficiaryId}
                          {r.willRaiseAdvice ? ' · advice raised on send' : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{r.invoiceNumber}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.vendorName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{r.beneficiaryName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.address}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {r.accountNumberMasked} · {r.ifsc}
                      </TableCell>
                      <TableCell align="right">{currency(r.amount)}</TableCell>
                      <TableCell>
                        {r.issues.length === 0 ? (
                          <Typography variant="caption" color="success.main">
                            Ready
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="error.main">
                            {r.issues.join(' ')}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {submit.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage(submit.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={submit.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => submit.mutate()}
          disabled={!p?.canSubmit || submit.isPending || preview.isFetching}
          startIcon={submit.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {submit.isPending ? 'Sending to NGPS…' : 'Send to NGPS'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
