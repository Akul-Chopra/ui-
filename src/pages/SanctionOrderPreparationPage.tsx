import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, Chip, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { PlaylistAddCheck, Send, Warning } from '@mui/icons-material';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusChip } from '@/components/StatusChip';
import { BeneficiaryCell, BENEFICIARY_HEADER } from '@/components/BeneficiaryCell';
import { SanctionOrderSubmitDialog } from '@/components/SanctionOrderSubmitDialog';
import { ngpsSanctionOrdersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { SanctionCandidate } from '@/api/types';
import { currency } from '@/lib/format';

/**
 * NGPS Sanction Order Preparation. Lists the finance-settled invoices that can be paid
 * through NGPS, lets the officer pick a batch, previews the order exactly as NGPS will
 * receive it, and pushes it (Save Sanction Order). Signatories then build and sign the
 * Payment Order inside NGPS; results flow back on the Sanction Orders screen.
 */
export function SanctionOrderPreparationPage() {
  const navigate = useNavigate();
  // Kept by id across pages and searches, so a batch can be built from several pages.
  const [selected, setSelected] = useState<Map<string, SanctionCandidate>>(new Map());
  const [submitOpen, setSubmitOpen] = useState(false);

  const setup = useQuery({ queryKey: ['ngps-sanction-setup'], queryFn: ngpsSanctionOrdersApi.setup });
  const s = setup.data;
  const ready = !!s && s.isNgpsConfigured && s.isTenantConfigured && s.isUserLinked && s.isSignatory;

  const toggle = (c: SanctionCandidate) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(c.invoiceId)) next.delete(c.invoiceId);
      else next.set(c.invoiceId, c);
      return next;
    });

  const selectedRows = [...selected.values()];
  const selectedTotal = selectedRows.reduce((sum, c) => sum + c.amount, 0);
  // NGPS rejects an order with more beneficiaries than its per-Payment-Order limit (section 9.1).
  const overLimit = !!s && s.maxBeneficiariesPerOrder > 0 && selected.size > s.maxBeneficiariesPerOrder;

  const columns: Column<SanctionCandidate>[] = [
    {
      key: 'select',
      header: '',
      width: 48,
      render: (c) => (
        <Checkbox
          size="small"
          checked={selected.has(c.invoiceId)}
          disabled={!ready || c.issues.length > 0}
          onChange={() => toggle(c)}
          inputProps={{ 'aria-label': `Select ${c.invoiceNumber}` }}
        />
      ),
    },
    {
      key: 'invoiceNumber',
      header: 'Invoice',
      render: (c) => (
        <Stack>
          <Typography variant="body2" fontWeight={600}>
            {c.invoiceNumber}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {c.vendorName} · {c.vendorCode}
          </Typography>
        </Stack>
      ),
    },
    {
      key: 'beneficiary',
      header: BENEFICIARY_HEADER,
      render: (c) => (
        <BeneficiaryCell
          beneficiaryName={c.beneficiaryName}
          vendorName={c.vendorName}
          accountNumberMasked={c.accountNumberMasked}
          ifsc={c.ifsc}
        />
      ),
    },
    { key: 'departmentName', header: 'Department' },
    { key: 'amount', header: 'Amount', align: 'right', render: (c) => currency(c.amount) },
    {
      key: 'payment',
      header: 'Payment',
      render: (c) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          {c.paymentStatus ? (
            <StatusChip status={c.paymentStatus} />
          ) : (
            <Chip label="Advice on submit" size="small" variant="outlined" />
          )}
          {c.isReprocess && <Chip label="Re-send" size="small" color="warning" />}
        </Stack>
      ),
    },
    {
      key: 'issues',
      header: 'Checks',
      render: (c) =>
        c.issues.length === 0 ? (
          <Typography variant="caption" color="success.main">
            Ready
          </Typography>
        ) : (
          <Tooltip title={c.issues.join(' ')}>
            <Chip icon={<Warning fontSize="small" />} label={`${c.issues.length} issue(s)`} size="small" color="error" />
          </Tooltip>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Prepare Sanction Order"
        subtitle="Select approved invoices for payment processing."
        icon={<PlaylistAddCheck />}
        actions={
          <Button variant="outlined" onClick={() => navigate('/finance/ngps/sanction-orders')}>
            View sent orders
          </Button>
        }
      />

      {setup.isError && (
        <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
          {errorMessage(setup.error)}
        </Alert>
      )}
      {s && !s.isSignatory && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Sanction Orders are available only to NGPS signatories (Maker or Checker). Ask the administrator to link your
          VPS account to your NGPS signatory user.
        </Alert>
      )}
      {s && !s.isNgpsConfigured && (
        <Alert severity="error" sx={{ mb: 2 }}>
          NGPS is not configured on this server (portal keys). Contact the administrator.
        </Alert>
      )}
      {s && !s.isTenantConfigured && (
        <Alert severity="error" sx={{ mb: 2 }}>
          NGPS is not set up for this organisation — the Portal ID, Scheme ID and master codes issued by NGPS are
          missing. Contact the administrator.
        </Alert>
      )}
      {s && !s.isUserLinked && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your VPS account is not linked to an NGPS Maker or Checker. Ask the administrator to set your NGPS User Key.
        </Alert>
      )}
      <Paper sx={{ px: 2, py: 1.5, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 2 }} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2">
              {selected.size} selected · {currency(selectedTotal)}
            </Typography>
            <Typography variant="caption" color={overLimit ? 'error' : 'text.secondary'}>
              {overLimit
                ? `NGPS accepts at most ${s?.maxBeneficiariesPerOrder} beneficiaries in one order. Send the rest in another order.`
                : 'The order is sent to NGPS under your NGPS user. Payments move to Processing until NGPS returns the bank result.'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, '& .MuiButton-root': { whiteSpace: 'nowrap' } }}>
            <Button disabled={selected.size === 0} onClick={() => setSelected(new Map())}>
              Clear
            </Button>
            <Button
              variant="contained"
              startIcon={<Send />}
              disabled={!ready || selected.size === 0 || overLimit}
              onClick={() => setSubmitOpen(true)}
            >
              Preview & send
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {s?.isSignatory && (
        <DataTable
          queryKey={['ngps-sanction-candidates']}
          fetcher={ngpsSanctionOrdersApi.candidates}
          columns={columns}
          rowKey={(c) => c.invoiceId}
          searchPlaceholder="Search by invoice, vendor name or code…"
        />
      )}

      <SanctionOrderSubmitDialog
        open={submitOpen}
        invoiceIds={selectedRows.map((c) => c.invoiceId)}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={(result) => {
          setSubmitOpen(false);
          setSelected(new Map());
          navigate(`/finance/ngps/sanction-orders/${result.sanctionOrderId}`);
        }}
      />
    </>
  );
}
