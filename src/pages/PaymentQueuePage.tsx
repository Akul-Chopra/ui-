import { Payments, Verified, Warning } from '@mui/icons-material';
import { Stack, Typography, Chip } from '@mui/material';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusChip } from '@/components/StatusChip';
import { paymentsApi } from '@/api/endpoints';
import type { PaymentQueueItem } from '@/api/types';
import { compactCurrency } from '@/lib/format';

const columns: Column<PaymentQueueItem>[] = [
  {
    key: 'invoiceNumber',
    header: 'Invoice',
    render: (p) => (
      <Stack>
        <Typography variant="body2" fontWeight={600}>
          {p.invoiceNumber}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {p.vendorName} · {p.vendorCode}
        </Typography>
      </Stack>
    ),
  },
  { key: 'departmentName', header: 'Department' },
  { key: 'grossAmount', header: 'Gross', align: 'right', render: (p) => compactCurrency(p.grossAmount) },
  {
    key: 'approvedDeductionAmount',
    header: 'Deduction',
    align: 'right',
    render: (p) => (p.approvedDeductionAmount > 0 ? `−${compactCurrency(p.approvedDeductionAmount)}` : '—'),
  },
  {
    key: 'outstandingAmount',
    header: 'Outstanding',
    align: 'right',
    render: (p) => (
      <Typography variant="body2" fontWeight={700} color="warning.main">
        {compactCurrency(p.outstandingAmount)}
      </Typography>
    ),
  },
  {
    key: 'ageInDays',
    header: 'Age',
    align: 'right',
    render: (p) =>
      p.ageInDays > 30 ? (
        <Chip icon={<Warning fontSize="small" />} label={`${p.ageInDays}d`} size="small" color="warning" />
      ) : (
        `${p.ageInDays}d`
      ),
  },
  {
    key: 'bank',
    header: 'Bank',
    render: (p) =>
      p.isBankVerified ? (
        <Verified color="success" fontSize="small" titleAccess="Bank verified" />
      ) : (
        <Typography variant="caption" color="text.secondary">
          Unverified
        </Typography>
      ),
  },
  {
    key: 'paymentStatus',
    header: 'Payment',
    render: (p) => (p.paymentStatus ? <StatusChip status={p.paymentStatus} /> : <Chip label="Not raised" size="small" variant="outlined" />),
  },
];

export function PaymentQueuePage() {
  return (
    <>
      <PageHeader
        title="Payment Queue"
        subtitle="Finance-settled invoices awaiting disbursement, oldest first"
        icon={<Payments />}
      />
      <DataTable
        queryKey={['payment-queue']}
        fetcher={paymentsApi.queue}
        columns={columns}
        rowKey={(p) => p.invoiceId}
        searchPlaceholder="Search the queue…"
      />
    </>
  );
}
