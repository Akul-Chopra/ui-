import { useState } from 'react';
import { Stack, Typography, Button } from '@mui/material';
import { PriceCheck } from '@mui/icons-material';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusChip } from '@/components/StatusChip';
import { RecordPaymentDialog } from '@/components/RecordPaymentDialog';
import { invoicesApi } from '@/api/endpoints';
import type { InvoiceListItem } from '@/api/types';
import { compactCurrency } from '@/lib/format';

/**
 * Dedicated "Record Payment" screen for accounts / finance officers. It lists the invoices
 * finance has approved that still owe money, and opens the payment dialog straight from the
 * page — deliberately not nested inside the invoice drawer, so the form is a top-level modal
 * with no competing focus trap or backdrop above it.
 */
export function RecordPaymentsPage() {
  const [selected, setSelected] = useState<InvoiceListItem | null>(null);

  const columns: Column<InvoiceListItem>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice',
      render: (i) => (
        <Stack>
          <Typography variant="body2" fontWeight={600}>
            {i.invoiceNumber}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {i.vendorName} · {i.workOrderNumber}
          </Typography>
        </Stack>
      ),
    },
    { key: 'departmentName', header: 'Department' },
    {
      key: 'netPayableAmount',
      header: 'Net Payable',
      align: 'right',
      render: (i) => compactCurrency(i.netPayableAmount),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      render: (i) => (
        <Typography variant="body2" fontWeight={700} color="warning.main">
          {compactCurrency(i.netPayableAmount - i.paidAmount)}
        </Typography>
      ),
    },
    { key: 'status', header: 'Status', render: (i) => <StatusChip status={i.status} /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (i) => (
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<PriceCheck />}
          onClick={() => setSelected(i)}
        >
          Record payment
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Record Payment"
        subtitle="Finance-approved invoices with an amount still outstanding — enter the payment to mark them paid"
        icon={<PriceCheck />}
      />
      <DataTable
        queryKey={['invoices', 'awaiting-payment']}
        fetcher={invoicesApi.list}
        extraParams={{ awaitingPayment: true, sortBy: 'submittedOn', sortDescending: false }}
        columns={columns}
        rowKey={(i) => i.id}
        searchPlaceholder="Search by invoice, vendor or purchase/work order…"
      />

      {/* Rendered at page level (not inside a drawer) so the dialog owns focus and no overlay
          sits above it — the reason the drawer-nested version was uninteractable by mouse. */}
      <RecordPaymentDialog invoice={selected} onClose={() => setSelected(null)} />
    </>
  );
}
