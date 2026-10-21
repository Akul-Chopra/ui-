import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Store, Verified, HourglassEmpty, Add, AccountBalance, Person, Badge } from '@mui/icons-material';
import { Stack, Typography, Rating, Chip, Button, Box, Paper, CircularProgress, Alert } from '@mui/material';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusChip } from '@/components/StatusChip';
import { VendorReviewDialog } from '@/components/VendorReviewDialog';
import { RegisterVendorDialog } from '@/components/RegisterVendorDialog';
import { Section, FactGrid, Fact, CARD_SX } from '@/pages/ContractDetailPage';
import { BankAccountPanel } from '@/components/BankAccountPanel';
import { vendorsApi, type ListParams } from '@/api/endpoints';
import type { VendorListItem } from '@/api/types';
import { compactCurrency } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';

const columns: Column<VendorListItem>[] = [
  {
    key: 'vendorCode',
    header: 'Vendor',
    render: (v) => (
      <Stack>
        <Typography variant="body2" fontWeight={600}>
          {v.legalName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {v.vendorCode} · {v.gstin}
        </Typography>
      </Stack>
    ),
  },
  {
    key: 'msmeCategory',
    header: 'MSME',
    render: (v) =>
      v.msmeCategory === 'NotRegistered' ? (
        <Typography variant="caption" color="text.secondary">
          —
        </Typography>
      ) : (
        <Chip label={v.msmeCategory} size="small" color="secondary" variant="outlined" />
      ),
  },
  { key: 'city', header: 'Location', render: (v) => `${v.city}, ${v.state}` },
  {
    key: 'verification',
    header: 'Verified',
    render: (v) =>
      v.isGstVerified ? (
        <Verified color="success" fontSize="small" titleAccess="GST verified" />
      ) : (
        <Typography variant="caption" color="text.secondary">
          Pending
        </Typography>
      ),
  },
  {
    key: 'rating',
    header: 'Rating',
    render: (v) => (v.rating ? <Rating value={v.rating} precision={0.5} size="small" readOnly /> : '—'),
  },
  { key: 'workOrderCount', header: 'Orders', align: 'right' },
  {
    key: 'totalPaidAmount',
    header: 'Paid',
    align: 'right',
    render: (v) => compactCurrency(v.totalPaidAmount),
  },
  { key: 'status', header: 'Status', render: (v) => <StatusChip status={v.status} /> },
];

// The standings an officer filters the list by. Pending verification is first, because
// clearing that queue is the officer's recurring task.
const STATUS_FILTERS = [
  { label: 'Pending verification', value: 'PendingVerification' },
  { label: 'Active', value: 'Active' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'Blacklisted', value: 'Blacklisted' },
  { label: 'All', value: '' },
] as const;

export function VendorsPage() {
  const { can, isVendor, user } = useAuth();
  const [status, setStatus] = useState<string>('PendingVerification');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  // A vendor-portal user manages only their own record — show it as a read-only profile,
  // not the officer register (and never the verify/approve review dialog).
  if (isVendor) {
    return <VendorSelfProfile vendorId={user?.vendorId ?? null} />;
  }

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle="Registered suppliers, their standing, and pending registrations to review"
        icon={<Store />}
        actions={
          can(Permissions.vendorCreate) && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setRegisterOpen(true)}>
              Register vendor
            </Button>
          )
        }
      />

      <DataTable
        queryKey={['vendors', status]}
        fetcher={(p: ListParams) => vendorsApi.list({ ...p, status: status || undefined })}
        columns={columns}
        rowKey={(v) => v.id}
        searchPlaceholder="Search by name, GSTIN, PAN…"
        onRowClick={(v) => setReviewId(v.id)}
        filters={
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {STATUS_FILTERS.map((f) => (
              <Chip
                key={f.value || 'all'}
                label={f.label}
                size="small"
                icon={f.value === 'PendingVerification' ? <HourglassEmpty fontSize="small" /> : undefined}
                color={status === f.value ? 'primary' : 'default'}
                variant={status === f.value ? 'filled' : 'outlined'}
                onClick={() => setStatus(f.value)}
              />
            ))}
          </Stack>
        }
      />

      <VendorReviewDialog vendorId={reviewId} open={!!reviewId} onClose={() => setReviewId(null)} />
      <RegisterVendorDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />
    </>
  );
}

/** Read-only "My Profile" view a vendor sees in place of the officer register. */
function VendorSelfProfile({ vendorId }: { vendorId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: () => vendorsApi.get(vendorId!),
    enabled: !!vendorId,
  });

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your organisation's details as registered on the platform" icon={<Store />} />
      {!vendorId ? (
        <Alert severity="warning">
          Your account isn't linked to a vendor profile. Please contact your organisation's administrator.
        </Alert>
      ) : isLoading || !data ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, ...CARD_SX }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} spacing={1.5}>
              <Box>
                <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                  {data.legalName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {data.vendorCode}
                  {data.tradeName ? ` · ${data.tradeName}` : ''}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <StatusChip status={data.status} />
                {data.isGstVerified && <Chip label="GST verified" size="small" color="success" variant="outlined" />}
                {data.isBankVerified && <Chip label="Bank verified" size="small" color="success" variant="outlined" />}
              </Stack>
            </Stack>
          </Paper>

          <Section icon={<Badge fontSize="small" />} title="Identity">
            <FactGrid>
              <Fact label="GSTIN" value={data.gstin} />
              <Fact label="PAN" value={data.pan} />
              <Fact label="Constitution" value={data.constitution} />
              <Fact label="MSME" value={data.msmeCategory === 'NotRegistered' ? '—' : data.msmeCategory} />
            </FactGrid>
          </Section>

          <Section icon={<Person fontSize="small" />} title="Contact">
            <FactGrid>
              <Fact label="Contact person" value={data.contactPersonName} />
              <Fact label="Mobile" value={data.mobile} />
              <Fact label="Email" value={data.email} />
              <Fact label="Website" value={data.website ?? '—'} />
            </FactGrid>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {[data.addressLine1, data.addressLine2, data.city, data.state, data.pincode].filter(Boolean).join(', ')}
            </Typography>
          </Section>

          {data.bankAccounts?.length > 0 && (
            <Section icon={<AccountBalance fontSize="small" />} title="Bank accounts">
              <Stack spacing={1.25}>
                {data.bankAccounts.map((b) => (
                  <BankAccountPanel
                    key={b.id}
                    bankName={b.bankName}
                    accountNumber={b.accountNumber}
                    ifscCode={b.ifscCode}
                    isPrimary={b.isPrimary}
                    accountHolderName={b.accountHolderName}
                  />
                ))}
              </Stack>
            </Section>
          )}

          <Typography variant="caption" color="text.secondary">
            To change any of these details, raise a change request — your organisation's officer will review it.
          </Typography>
        </Stack>
      )}
    </>
  );
}
