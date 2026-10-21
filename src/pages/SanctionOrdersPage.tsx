import { useNavigate } from 'react-router-dom';
import { Button, Stack, Typography } from '@mui/material';
import { AccountBalance, PlaylistAddCheck } from '@mui/icons-material';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { SanctionOrderStatusChip } from '@/components/NgpsStatusChip';
import { ngpsSanctionOrdersApi } from '@/api/endpoints';
import type { SanctionOrderListItem } from '@/api/types';
import { compactCurrency, date, dateTime } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';

const columns: Column<SanctionOrderListItem>[] = [
  {
    key: 'sanctionOrderNo',
    header: 'Sanction Order',
    render: (o) => (
      <Stack>
        <Typography variant="body2" fontWeight={600}>
          {o.sanctionOrderNo}
          {o.soType === 2 ? ' · Re-process' : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {o.description || '—'} · {date(o.sanctionDate)}
        </Typography>
      </Stack>
    ),
  },
  { key: 'totalBeneficiaries', header: 'Beneficiaries', align: 'right' },
  { key: 'totalAmount', header: 'Amount', align: 'right', render: (o) => compactCurrency(o.totalAmount) },
  {
    key: 'state',
    header: 'Status',
    render: (o) => (
      <Stack spacing={0.25}>
        <SanctionOrderStatusChip state={o.state} code={o.ngpsResponseCode} text={o.ngpsStatusText} />
        {o.ngpsPaymentOrderId && (
          <Typography variant="caption" color="text.secondary">
            PO {o.ngpsPaymentOrderId}
          </Typography>
        )}
      </Stack>
    ),
  },
  {
    key: 'results',
    header: 'Paid / Failed',
    align: 'right',
    render: (o) => (
      <Typography variant="body2">
        <Typography component="span" color="success.main" fontWeight={600}>
          {o.paidCount}
        </Typography>{' '}
        /{' '}
        <Typography component="span" color={o.failedCount > 0 ? 'error.main' : 'text.secondary'} fontWeight={600}>
          {o.failedCount}
        </Typography>
      </Typography>
    ),
  },
  {
    key: 'submitted',
    header: 'Sent',
    render: (o) => (
      <Stack>
        <Typography variant="body2">{o.submittedByName || '—'}</Typography>
        <Typography variant="caption" color="text.secondary">
          {o.submittedOn ? dateTime(o.submittedOn) : 'Not sent'}
        </Typography>
      </Stack>
    ),
  },
];

/** The Sanction Orders pushed to NGPS and how far each has got towards the bank's result. */
export function SanctionOrdersPage() {
  const navigate = useNavigate();
  const { can } = useAuth();

  return (
    <>
      <PageHeader
        title="NGPS Sanction Orders"
        subtitle="Orders sent to NGPS, their signing and bank progress, and the per-vendor payment results"
        icon={<AccountBalance />}
        actions={
          can(Permissions.paymentNgpsPrepare) ? (
            <Button variant="contained" startIcon={<PlaylistAddCheck />} onClick={() => navigate('/finance/ngps/prepare')}>
              Prepare order
            </Button>
          ) : undefined
        }
      />
      <DataTable
        queryKey={['ngps-sanction-orders']}
        fetcher={ngpsSanctionOrdersApi.list}
        columns={columns}
        rowKey={(o) => o.id}
        onRowClick={(o) => navigate(`/finance/ngps/sanction-orders/${o.id}`)}
        searchPlaceholder="Search by order no., description, NGPS reference or PO…"
      />
    </>
  );
}
