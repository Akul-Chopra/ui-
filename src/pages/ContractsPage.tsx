import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Description, Warning, Add, Send } from '@mui/icons-material';
import { Stack, Typography, LinearProgress, Box, Chip, Button } from '@mui/material';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusChip } from '@/components/StatusChip';
import { CreateContractDialog } from '@/components/CreateContractDialog';
import { SubmitForApprovalDialog } from '@/components/SubmitForApprovalDialog';
import { PendingWithMeToggle } from '@/components/PendingWithMeToggle';
import { PendingWithFilter } from '@/components/PendingWithFilter';
import { AdvancedSearchPanel, EMPTY_ADVANCED_FILTERS, type AdvancedFilters } from '@/components/AdvancedSearchPanel';
import { contractsApi } from '@/api/endpoints';
import type { ContractListItem } from '@/api/types';
import { compactCurrency, date } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { useLookups } from '@/lib/useLookups';
import { Permissions } from '@/lib/permissions';

const CONTRACT_STATUS_OPTIONS = [
  { value: '0', label: 'Draft' },
  { value: '1', label: 'Pending Approval' },
  { value: '2', label: 'Approved' },
  { value: '3', label: 'Active' },
  { value: '4', label: 'Suspended' },
  { value: '5', label: 'Expired' },
  { value: '6', label: 'Terminated' },
  { value: '7', label: 'Rejected' },
  { value: '8', label: 'Cancelled' },
];

const CONTRACT_SORT_OPTIONS = [
  { value: 'recentlyActioned', label: 'Recently actioned' },
  { value: 'createdOn', label: 'Newest first' },
  { value: 'contractValue', label: 'Value (high to low)' },
  { value: 'endDate', label: 'Expiry date' },
];

/** Translates the generic advanced-search state into GetContractsQuery's own param names. */
function toContractParams(f: AdvancedFilters) {
  return {
    status: f.status,
    vendorId: f.vendorId,
    minValue: f.minAmount,
    maxValue: f.maxAmount,
    createdFrom: f.dateFrom,
    createdTo: f.dateTo,
    contractCategoryId: f.category,
    isExpired: f.overdueOnly,
    sortBy: f.sortBy,
    sortDescending: true,
  };
}

function SubmitContractButton({ contract }: { contract: ContractListItem }) {
  const { can } = useAuth();
  const [submitOpen, setSubmitOpen] = useState(false);

  if (contract.status !== 'Draft' || !can(Permissions.contractSubmit)) return null;
  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<Send fontSize="small" />}
        onClick={(e) => {
          e.stopPropagation();
          setSubmitOpen(true);
        }}
      >
        Submit
      </Button>
      <SubmitForApprovalDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        reference={contract.contractNumber}
        documentLabel="contract"
        submitFn={(body) => contractsApi.submit(contract.id, body)}
        invalidateKey={['contracts']}
      />
    </>
  );
}

const columns: Column<ContractListItem>[] = [
  {
    key: 'contractNumber',
    header: 'Contract',
    render: (c) => (
      <Stack>
        <Typography variant="body2" fontWeight={600}>
          {c.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {c.contractNumber} · {c.vendorName}
          {c.versionNumber > 1 ? ` · v${c.versionNumber}` : ''}
        </Typography>
      </Stack>
    ),
  },
  { key: 'departmentName', header: 'Department', render: (c) => c.departmentName ?? '—' },
  {
    key: 'value',
    header: 'Value / Committed',
    render: (c) => {
      const pct = c.contractValue > 0 ? (c.committedValue / c.contractValue) * 100 : 0;
      return (
        <Box sx={{ minWidth: 150 }}>
          <Typography variant="caption">
            {compactCurrency(c.committedValue)} of {compactCurrency(c.contractValue)}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(pct, 100)}
            sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
          />
        </Box>
      );
    },
  },
  {
    key: 'endDate',
    header: 'Expiry',
    render: (c) => (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <span>{date(c.endDate)}</span>
        {c.daysToExpiry >= 0 && c.daysToExpiry <= 90 && (
          <Chip
            icon={<Warning fontSize="small" />}
            label={`${c.daysToExpiry}d`}
            size="small"
            color="warning"
          />
        )}
      </Stack>
    ),
  },
  {
    key: 'pendingWith',
    header: 'Pending with',
    render: (c) =>
      c.pendingWith ? (
        <Chip label={c.pendingWith} size="small" color="warning" variant="outlined" />
      ) : (
        <Typography variant="caption" color="text.disabled">
          —
        </Typography>
      ),
  },
  { key: 'status', header: 'Status', render: (c) => <StatusChip status={c.status} /> },
  { key: 'actions', header: '', align: 'right', render: (c) => <SubmitContractButton contract={c} /> },
];

export function ContractsPage() {
  const { can, isVendor } = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [pendingWith, setPendingWith] = useState('');
  const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);
  const lookups = useLookups();

  return (
    <>
      <PageHeader
        title="Contracts"
        subtitle="Agreements that purchase orders / work orders draw against"
        icon={<Description />}
        actions={
          can(Permissions.contractCreate) && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
              New contract
            </Button>
          )
        }
      />
      <DataTable
        queryKey={['contracts', pendingOnly, pendingWith, advanced]}
        fetcher={contractsApi.list}
        columns={isVendor ? columns.filter((c) => c.key !== 'pendingWith') : columns}
        rowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/contracts/${c.id}`)}
        searchPlaceholder="Search by number, title, vendor…"
        extraParams={{
          ...(pendingOnly ? { pendingWithMe: true } : {}),
          ...(pendingWith ? { pendingWithUserId: pendingWith } : {}),
          ...toContractParams(advanced),
        }}
        filters={
          !isVendor && (
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <PendingWithMeToggle value={pendingOnly} onChange={setPendingOnly} />
              <PendingWithFilter value={pendingWith} onChange={setPendingWith} entityType={0} />
              <AdvancedSearchPanel
                filters={advanced}
                onChange={setAdvanced}
                statusOptions={CONTRACT_STATUS_OPTIONS}
                categoryOptions={(lookups.data?.contractCategories ?? []).map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                categoryLabel="Category"
                overdueLabel="Expired only"
                amountLabel="Value"
                sortOptions={CONTRACT_SORT_OPTIONS}
              />
            </Stack>
          )
        }
      />
      <CreateContractDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
