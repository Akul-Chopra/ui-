import { Verified, Warning } from '@mui/icons-material';
import { Box, Stack, Typography, Chip } from '@mui/material';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusChip } from '@/components/StatusChip';
import { BeneficiaryCell, BENEFICIARY_HEADER } from '@/components/BeneficiaryCell';
import { paymentsApi } from '@/api/endpoints';
import type { PaymentQueueItem } from '@/api/types';
import { compactCurrency } from '@/lib/format';

/** Amounts, references and short values stay on one line so the rows line up. */
const oneLine = { whiteSpace: 'nowrap' } as const;

const columns: Column<PaymentQueueItem>[] = [
  {
    key: 'invoiceNumber',
    header: 'Invoice',
    render: (p) => (
      <Stack>
        <Typography variant="body2" fontWeight={600} sx={oneLine}>
          {p.invoiceNumber}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={oneLine}>
          {p.vendorCode}
        </Typography>
        {/* The vendor's name is already in the Beneficiary/Vendor column unless the account
            holder is someone else; only then is it repeated here. */}
        {p.beneficiaryName && p.beneficiaryName !== p.vendorName && (
          <Typography variant="caption" color="text.secondary">
            {p.vendorName}
          </Typography>
        )}
      </Stack>
    ),
  },
  {
    key: 'beneficiary',
    header: BENEFICIARY_HEADER,
    render: (p) => (
      <BeneficiaryCell
        beneficiaryName={p.beneficiaryName}
        vendorName={p.vendorName}
        accountNumberMasked={p.accountNumberMasked}
        ifsc={p.ifsc}
      />
    ),
  },
  { key: 'departmentName', header: 'Department' },
  {
    key: 'grossAmount',
    header: 'Gross',
    align: 'right',
    render: (p) => <Typography variant="body2" sx={oneLine}>{compactCurrency(p.grossAmount)}</Typography>,
  },
  {
    key: 'approvedDeductionAmount',
    header: 'Deduction',
    align: 'right',
    render: (p) => (
      <Typography variant="body2" sx={oneLine}>
        {p.approvedDeductionAmount > 0 ? `−${compactCurrency(p.approvedDeductionAmount)}` : '—'}
      </Typography>
    ),
  },
  {
    key: 'outstandingAmount',
    header: 'Outstanding',
    align: 'right',
    render: (p) => (
      <Typography variant="body2" fontWeight={700} color="warning.main" sx={oneLine}>
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
        <Typography variant="body2" sx={oneLine}>{`${p.ageInDays}d`}</Typography>
      ),
  },
  {
    key: 'bank',
    header: 'Bank',
    align: 'center',
    render: (p) =>
      p.isBankVerified ? (
        <Verified color="success" fontSize="small" titleAccess="Bank verified" sx={{ verticalAlign: 'middle' }} />
      ) : (
        <Typography variant="caption" color="text.secondary" sx={oneLine}>
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

/** Finance-settled invoices awaiting disbursement, oldest first. Shown as the first Reports tab. */
export function PaymentQueueTable() {
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Finance-settled invoices awaiting disbursement, oldest first.
      </Typography>
      {/* Nine columns: tighter side padding (8px, 16px at the table edges) lets them fit the
          width instead of scrolling sideways; columns size to their content. */}
      <Box
        sx={{
          '& .MuiTableCell-root': { px: 1 },
          '& .MuiTableCell-root:first-of-type': { pl: 2 },
          '& .MuiTableCell-root:last-of-type': { pr: 2 },
        }}
      >
        <DataTable
          queryKey={['payment-queue']}
          fetcher={paymentsApi.queue}
          columns={columns}
          rowKey={(p) => p.invoiceId}
          searchPlaceholder="Search the queue…"
        />
      </Box>
    </Stack>
  );
}
