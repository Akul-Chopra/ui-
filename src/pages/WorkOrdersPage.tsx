import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Assignment, Link as LinkIcon, Timeline, Add, Send, Publish } from '@mui/icons-material';
import { Stack, Typography, Chip, Button, Box, LinearProgress } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusChip } from '@/components/StatusChip';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';
import { SubmitForApprovalDialog } from '@/components/SubmitForApprovalDialog';
import { PendingWithMeToggle } from '@/components/PendingWithMeToggle';
import { PendingWithFilter } from '@/components/PendingWithFilter';
import { AdvancedSearchPanel, EMPTY_ADVANCED_FILTERS, type AdvancedFilters } from '@/components/AdvancedSearchPanel';
import { workOrdersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { WorkOrderListItem } from '@/api/types';
import { compactCurrency, date } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

const WORK_ORDER_STATUS_OPTIONS = [
  { value: '0', label: 'Draft' },
  { value: '1', label: 'Pending Approval' },
  { value: '2', label: 'Approved' },
  { value: '3', label: 'Published' },
  { value: '4', label: 'In Progress' },
  { value: '5', label: 'Completed' },
  { value: '6', label: 'Rejected' },
  { value: '7', label: 'Cancelled' },
  { value: '8', label: 'On Hold' },
];

const WORK_ORDER_TYPE_OPTIONS = [
  { value: '0', label: 'One-time' },
  { value: '1', label: 'Monthly' },
  { value: '2', label: 'Quarterly' },
  { value: '3', label: 'Yearly' },
  { value: '4', label: 'Milestone' },
];

const WORK_ORDER_SORT_OPTIONS = [
  { value: 'recentlyActioned', label: 'Recently actioned' },
  { value: 'issueDate', label: 'Newest first' },
  { value: 'totalAmount', label: 'Value (high to low)' },
  { value: 'expectedCompletionDate', label: 'Due date' },
];

/** Translates the generic advanced-search state into GetWorkOrdersQuery's own param names. */
function toWorkOrderParams(f: AdvancedFilters) {
  return {
    status: f.status,
    vendorId: f.vendorId,
    minAmount: f.minAmount,
    maxAmount: f.maxAmount,
    issuedFrom: f.dateFrom,
    issuedTo: f.dateTo,
    paymentScheduleType: f.category,
    isDelayed: f.overdueOnly,
    sortBy: f.sortBy,
    sortDescending: true,
  };
}

/** The one contextual action a work order row offers, by status: submit a draft, publish an approved one. */
function WorkOrderRowAction({ workOrder }: { workOrder: WorkOrderListItem }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [submitOpen, setSubmitOpen] = useState(false);

  const publish = useMutation({
    mutationFn: () => workOrdersApi.publish(workOrder.id),
    onSuccess: () => {
      dispatch(showToast({ message: `${workOrder.workOrderNumber} published to the vendor.`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  if (workOrder.status === 'Draft' && can(Permissions.workOrderSubmit)) {
    return (
      <>
        <Button size="small" variant="outlined" startIcon={<Send fontSize="small" />} onClick={stop(() => setSubmitOpen(true))}>
          Submit
        </Button>
        <SubmitForApprovalDialog
          open={submitOpen}
          onClose={() => setSubmitOpen(false)}
          reference={workOrder.workOrderNumber}
          documentLabel="purchase order / work order"
          submitFn={(body) => workOrdersApi.submit(workOrder.id, body)}
          invalidateKey={['work-orders']}
        />
      </>
    );
  }
  if (workOrder.status === 'Approved' && can(Permissions.workOrderPublish)) {
    return (
      <Button size="small" variant="contained" startIcon={<Publish fontSize="small" />} disabled={publish.isPending} onClick={stop(publish.mutate)}>
        Publish
      </Button>
    );
  }
  return null;
}

const columns: Column<WorkOrderListItem>[] = [
  {
    key: 'workOrderNumber',
    header: 'Purchase Order / Work Order',
    render: (w) => (
      <Stack>
        <Typography variant="body2" fontWeight={600}>
          {w.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {w.workOrderNumber} · {w.vendorName}
        </Typography>
      </Stack>
    ),
  },
  {
    key: 'contract',
    header: 'Contract',
    render: (w) =>
      w.contractNumber ? (
        <Chip icon={<LinkIcon fontSize="small" />} label={w.contractNumber} size="small" variant="outlined" />
      ) : (
        <Typography variant="caption" color="text.secondary">
          Direct
        </Typography>
      ),
  },
  {
    key: 'value',
    header: 'Value / Billable',
    render: (w) => {
      // How much of the order's value has been billed so far; the unfilled part is still
      // billable. Mirrors the contract's Value / Committed gauge.
      const billedPct = w.totalAmount > 0 ? (w.invoicedAmount / w.totalAmount) * 100 : 0;
      return (
        <Box sx={{ minWidth: 150 }}>
          <Typography variant="caption">
            {compactCurrency(w.billableBalance)} billable of {compactCurrency(w.totalAmount)}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(billedPct, 100)}
            sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
          />
        </Box>
      );
    },
  },
  {
    key: 'expectedCompletionDate',
    header: 'Due',
    render: (w) => (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <span>{date(w.expectedCompletionDate)}</span>
        {w.delayInDays > 0 && <Chip label={`+${w.delayInDays}d`} size="small" color="error" />}
        {w.isMilestoneBased && <Timeline fontSize="small" color="action" titleAccess="Milestone billing" />}
      </Stack>
    ),
  },
  {
    key: 'pendingWith',
    header: 'Pending with',
    render: (w) =>
      w.pendingWith ? (
        <Chip label={w.pendingWith} size="small" color="warning" variant="outlined" />
      ) : (
        <Typography variant="caption" color="text.disabled">
          —
        </Typography>
      ),
  },
  { key: 'status', header: 'Status', render: (w) => <StatusChip status={w.status} /> },
  { key: 'actions', header: '', align: 'right', render: (w) => <WorkOrderRowAction workOrder={w} /> },
];

export function WorkOrdersPage() {
  const { can, isVendor } = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [pendingWith, setPendingWith] = useState('');
  const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);

  return (
    <>
      <PageHeader
        title="Purchase Orders / Work Orders"
        subtitle="Instructions issued to vendors, and their billing status"
        icon={<Assignment />}
        actions={
          can(Permissions.workOrderCreate) && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
              New purchase order / work order
            </Button>
          )
        }
      />
      <DataTable
        queryKey={['work-orders', pendingOnly, pendingWith, advanced]}
        fetcher={workOrdersApi.list}
        columns={isVendor ? columns.filter((c) => c.key !== 'pendingWith') : columns}
        rowKey={(w) => w.id}
        onRowClick={(w) => navigate(`/work-orders/${w.id}`)}
        searchPlaceholder="Search by number, title, vendor…"
        extraParams={{
          ...(pendingOnly ? { pendingWithMe: true } : {}),
          ...(pendingWith ? { pendingWithUserId: pendingWith } : {}),
          ...toWorkOrderParams(advanced),
        }}
        filters={
          !isVendor && (
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <PendingWithMeToggle value={pendingOnly} onChange={setPendingOnly} />
              <PendingWithFilter value={pendingWith} onChange={setPendingWith} entityType={1} />
              <AdvancedSearchPanel
                filters={advanced}
                onChange={setAdvanced}
                statusOptions={WORK_ORDER_STATUS_OPTIONS}
                categoryOptions={WORK_ORDER_TYPE_OPTIONS}
                categoryLabel="Billing type"
                overdueLabel="Delayed only"
                sortOptions={WORK_ORDER_SORT_OPTIONS}
              />
            </Stack>
          )
        }
      />
      <CreateWorkOrderDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
