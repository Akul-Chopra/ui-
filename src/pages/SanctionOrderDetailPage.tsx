import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
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
// MUI 6 keeps the responsive `size` API on Grid2; the legacy Grid still uses item/xs/md.
import Grid from '@mui/material/Grid2';
import { AccountBalance, ArrowBack, Block, OpenInNew, Refresh, Replay } from '@mui/icons-material';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { SanctionOrderStatusChip, sanctionOrderStatus } from '@/components/NgpsStatusChip';
import { NgpsSsoDialog } from '@/components/NgpsSsoDialog';
import { ngpsSanctionOrdersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { SanctionOrderLine } from '@/api/types';
import { currency, date, dateTime } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

function BankResult({ line, orderState }: { line: SanctionOrderLine; orderState: string }) {
  if (line.paymentStatusId === 120) {
    return (
      <Stack>
        <Typography variant="body2" color="success.main" fontWeight={600}>
          Paid
        </Typography>
        <Typography variant="caption" color="text.secondary">
          UTR {line.bankTransactionNo || 'awaited'}
          {line.processDate ? ` · ${line.processDate}` : ''}
        </Typography>
      </Stack>
    );
  }
  if (line.paymentStatusId === 110) {
    return (
      <Stack>
        <Typography variant="body2" color="error.main" fontWeight={600}>
          Failed
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {line.failureReason || 'No reason given'}
        </Typography>
      </Stack>
    );
  }
  // A refused or withdrawn order never reached the bank; its payment was released.
  const notSent = orderState === 'Rejected' || orderState === 'Cancelled';
  return (
    <Typography variant="caption" color="text.secondary">
      {notSent ? 'Not sent' : 'Awaiting bank'}
    </Typography>
  );
}

/**
 * One Sanction Order: its NGPS progress (Payment Order, signer, bank status), the per-vendor
 * bank results, and the actions that move it on — refresh the status now, resend an
 * unconfirmed push, or go to NGPS to sign the Payment Order.
 */
export function SanctionOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [ssoOpen, setSsoOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const canPrepare = can(Permissions.paymentNgpsPrepare);

  const order = useQuery({
    queryKey: ['ngps-sanction-order', id],
    queryFn: () => ngpsSanctionOrdersApi.get(id),
    enabled: !!id,
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['ngps-sanction-order', id] });
    queryClient.invalidateQueries({ queryKey: ['ngps-sanction-orders'] });
    queryClient.invalidateQueries({ queryKey: ['ngps-sanction-candidates'] });
    queryClient.invalidateQueries({ queryKey: ['payment-queue'] });
  };

  const sync = useMutation({
    mutationFn: () => ngpsSanctionOrdersApi.sync(id),
    onSuccess: (r) => {
      const parts = [
        r.ngpsResponseCode
          ? `Status: ${sanctionOrderStatus({ state: 'Accepted', code: r.ngpsResponseCode, text: r.ngpsStatusText }).label}.`
          : null,
        r.paidNow > 0 ? `${r.paidNow} payment(s) marked paid.` : null,
        r.failedNow > 0 ? `${r.failedNow} payment(s) failed at the bank.` : null,
        r.message ?? null,
      ].filter(Boolean);
      dispatch(showToast({ message: parts.join(' ') || 'Status refreshed.', severity: r.failedNow > 0 ? 'warning' : 'success' }));
      refreshAll();
    },
    onError: (e) => {
      dispatch(showToast({ message: errorMessage(e), severity: 'error' }));
      refreshAll();
    },
  });

  const retry = useMutation({
    mutationFn: () => ngpsSanctionOrdersApi.retry(id),
    onSuccess: (r) => {
      dispatch(
        showToast({
          message: r.message,
          severity: r.state === 'Accepted' ? 'success' : r.state === 'Rejected' ? 'error' : 'warning',
        })
      );
      refreshAll();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const cancel = useMutation({
    mutationFn: () => ngpsSanctionOrdersApi.cancel(id, cancelReason.trim()),
    onSuccess: (r) => {
      dispatch(showToast({ message: r.message, severity: 'success' }));
      setCancelOpen(false);
      setCancelReason('');
      refreshAll();
    },
  });

  if (order.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (order.isError || !order.data) {
    return <Alert severity="error">{order.isError ? errorMessage(order.error) : 'Sanction Order not found.'}</Alert>;
  }

  const o = order.data;
  const open = o.state === 'Pending' || o.state === 'Accepted';
  const busy = sync.isPending || retry.isPending || cancel.isPending;

  return (
    <>
      <PageHeader
        title={`Sanction Order ${o.sanctionOrderNo}`}
        subtitle={o.description || 'NGPS Sanction Order'}
        icon={<AccountBalance />}
        actions={
          <>
            <Button startIcon={<ArrowBack />} onClick={() => navigate('/finance/ngps/sanction-orders')}>
              All orders
            </Button>
            {canPrepare && o.state === 'Pending' && (
              <Button variant="outlined" startIcon={<Replay />} disabled={busy} onClick={() => retry.mutate()}>
                {retry.isPending ? 'Sending…' : 'Send again'}
              </Button>
            )}
            {canPrepare && o.state === 'Pending' && (
              <Button color="error" startIcon={<Block />} disabled={busy} onClick={() => setCancelOpen(true)}>
                Cancel order
              </Button>
            )}
            {canPrepare && open && (
              <Button variant="outlined" startIcon={<Refresh />} disabled={busy} onClick={() => sync.mutate()}>
                {sync.isPending ? 'Refreshing…' : 'Refresh status'}
              </Button>
            )}
            {o.state === 'Accepted' && can(Permissions.paymentRecord) && (
              <Button variant="contained" startIcon={<OpenInNew />} onClick={() => setSsoOpen(true)}>
                Sign in NGPS
              </Button>
            )}
          </>
        }
      />

      {o.lastMessage && (
        <Alert
          severity={o.state === 'Rejected' ? 'error' : o.state === 'Pending' ? 'warning' : 'info'}
          sx={{ mb: 2, whiteSpace: 'pre-line' }}
        >
          {o.lastMessage}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field
              label="Status"
              value={<SanctionOrderStatusChip state={o.state} code={o.ngpsResponseCode} text={o.ngpsStatusText} />}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field label="Amount" value={currency(o.totalAmount)} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field label="Beneficiaries" value={o.totalBeneficiaries} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field label="NGPS reference" value={o.ngpsReferenceNo} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field label="Payment Order" value={o.ngpsPaymentOrderId} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field label="Signed by" value={o.ngpsSignerName ? `${o.ngpsSignerName}${o.ngpsSignedOn ? ` · ${o.ngpsSignedOn}` : ''}` : undefined} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field label="Remarks from NGPS" value={o.ngpsRemarks} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field label="Sanction date" value={date(o.sanctionDate)} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field
              label="Type · Frequency · Year"
              value={`${o.soType === 2 ? 'Re-process' : 'New'} · ${o.frequencyValue} · ${o.paymentYear}`}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field label="Portal · Scheme" value={`${o.portalId} · ${o.schemeId}`} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field
              label="Sent"
              value={o.submittedOn ? `${o.submittedByName ?? ''} · ${dateTime(o.submittedOn)}` : 'Not sent'}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field label="Last checked" value={o.lastPolledOn ? dateTime(o.lastPolledOn) : 'Never'} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Field label="Next automatic check" value={o.nextPollOn ? dateTime(o.nextPollOn) : '—'} />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reference / Invoice</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Beneficiary</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  Amount
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Bank result</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {o.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.lineNo}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {l.portalReferenceNo}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {l.invoiceNumber} · {l.vendorName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{l.beneficiaryName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {l.accountNumberMasked} · {l.ifscCode}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{currency(l.amount)}</TableCell>
                  <TableCell>
                    <StatusChip status={l.paymentStatus} />
                  </TableCell>
                  <TableCell>
                    <BankResult line={l} orderState={o.state} />
                    {l.validationMessage && (
                      <Typography variant="caption" color="error.main" component="div" sx={{ whiteSpace: 'pre-line' }}>
                        {l.validationMessage}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={cancelOpen} onClose={() => !cancel.isPending && setCancelOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Cancel Sanction Order {o.sanctionOrderNo}?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            VPS first asks NGPS whether it holds this order. If NGPS has no record of it, the order is cancelled
            and its payments go back to the list to be sent again. An order NGPS holds cannot be cancelled here.
          </DialogContentText>
          <TextField
            id="cancel-reason"
            label="Reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ maxLength: 500 }}
            autoFocus
          />
          {cancel.isError && (
            <Alert severity="error" sx={{ mt: 2, whiteSpace: 'pre-line' }}>
              {errorMessage(cancel.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)} disabled={cancel.isPending}>
            Keep order
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={cancel.isPending || cancelReason.trim().length === 0}
            onClick={() => cancel.mutate()}
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
          </Button>
        </DialogActions>
      </Dialog>
      <NgpsSsoDialog open={ssoOpen} onClose={() => setSsoOpen(false)} />
    </>
  );
}
