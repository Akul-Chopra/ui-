import { useNavigate } from 'react-router-dom';
import { Button, Stack, Typography } from '@mui/material';
import { AccountBalance, PlaylistAddCheck } from '@mui/icons-material';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { SanctionOrderStatusChip } from '@/components/NgpsStatusChip';
import { BeneficiaryCell, BENEFICIARY_HEADER } from '@/components/BeneficiaryCell';
import { ngpsSanctionOrdersApi } from '@/api/endpoints';
import type { SanctionOrderListItem } from '@/api/types';
import { compactCurrency, date, dateTime } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';

const columns: Column<SanctionOrderListItem>[] = [
  {
    key: 'sanctionOrderNo',
    header: 'Sanction Order',
    width: '20%',
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
  {
    key: 'beneficiary',
    header: BENEFICIARY_HEADER,
    width: '26%',
    render: (o) => (
      <Stack>
        <BeneficiaryCell
          beneficiaryName={o.beneficiaryName}
          vendorName={o.vendorName}
          accountNumberMasked={o.accountNumberMasked}
          ifsc={o.ifsc}
        />
        {o.totalBeneficiaries > 1 && (
          <Typography variant="caption" color="text.secondary">
            +{o.totalBeneficiaries - 1} more
          </Typography>
        )}
      </Stack>
    ),
  },
  { key: 'totalAmount', header: 'Amount', align: 'right', width: '12%', render: (o) => compactCurrency(o.totalAmount) },
  {
    key: 'state',
    header: 'Status',
    width: '22%',
    render: (o) => (
      <Stack spacing={0.25} alignItems="flex-start">
        <SanctionOrderStatusChip uniform state={o.state} code={o.ngpsResponseCode} text={o.ngpsStatusText} />
        {o.ngpsPaymentOrderId && (
          <Typography variant="caption" color="text.secondary">
            PO {o.ngpsPaymentOrderId}
          </Typography>
        )}
      </Stack>
    ),
  },
  {
    key: 'submitted',
    header: 'Sent',
    width: '20%',
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
        title="Sanction Orders"
        subtitle="Sent Sanction Orders, their signing and bank progress, and payment results"
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
