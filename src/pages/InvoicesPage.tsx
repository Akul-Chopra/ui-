import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReceiptLong,
  TrendingDown,
  Gavel,
  AccountBalance,
  Add,
  Payments,
  Description,
  Assignment,
  History,
} from '@mui/icons-material';
import { Button } from '@mui/material';
import { SubmitInvoiceDialog } from '@/components/SubmitInvoiceDialog';
import { useAuth } from '@/lib/useAuth';
import { Permissions, RoleCodes } from '@/lib/permissions';
import {
  Stack,
  Typography,
  Box,
  Divider,
  Paper,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  Alert,
  Avatar,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import Grid from '@mui/material/Grid2';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusChip } from '@/components/StatusChip';
import { SanctionOrderStatusChip } from '@/components/NgpsStatusChip';
import { InvoiceActivityTimeline } from '@/components/InvoiceLifecycle';
import { InvoiceReviewDialog } from '@/components/InvoiceReviewDialog';
import { ResubmitInvoiceDialog } from '@/components/ResubmitInvoiceDialog';
import { DocumentAttachments } from '@/components/DocumentAttachments';
import { PendingWithMeToggle } from '@/components/PendingWithMeToggle';
import { PendingWithFilter } from '@/components/PendingWithFilter';
import { AdvancedSearchPanel, EMPTY_ADVANCED_FILTERS, type AdvancedFilters } from '@/components/AdvancedSearchPanel';
import { DocumentLink } from '@/components/DocumentLink';
import { DetailPageShell } from '@/components/DetailPageShell';
import { invoicesApi } from '@/api/endpoints';
import type { InvoiceDetail, InvoiceListItem, InvoiceReviewContext } from '@/api/types';
import { currency, compactCurrency, date } from '@/lib/format';
import { initials } from '@/lib/initials';

const INVOICE_STATUS_OPTIONS = [
  { value: '0', label: 'Draft' },
  { value: '1', label: 'Submitted' },
  { value: '2', label: 'Under Technical Review' },
  { value: '3', label: 'Technical Approved' },
  { value: '4', label: 'Under Finance Review' },
  { value: '5', label: 'Finance Approved' },
  { value: '6', label: 'Pending Payment' },
  { value: '7', label: 'Partially Paid' },
  { value: '8', label: 'Paid' },
  { value: '9', label: 'Rejected' },
  { value: '10', label: 'Resubmitted' },
  { value: '11', label: 'Cancelled' },
  { value: '12', label: 'On Hold' },
];

const INVOICE_TYPE_OPTIONS = [
  { value: '0', label: 'Full' },
  { value: '1', label: 'Partial' },
  { value: '2', label: 'Milestone' },
  { value: '3', label: 'Advance' },
  { value: '4', label: 'Final Settlement' },
];

const INVOICE_SORT_OPTIONS = [
  { value: 'recentlyActioned', label: 'Recently actioned' },
  { value: 'submittedOn', label: 'Newest first' },
  { value: 'grossAmount', label: 'Amount (high to low)' },
  { value: 'dueDate', label: 'Due date' },
];

/** Translates the generic advanced-search state into GetInvoicesQuery's own param names. */
function toInvoiceParams(f: AdvancedFilters) {
  return {
    status: f.status,
    vendorId: f.vendorId,
    minAmount: f.minAmount,
    maxAmount: f.maxAmount,
    submittedFrom: f.dateFrom,
    submittedTo: f.dateTo,
    invoiceType: f.category,
    isOverdue: f.overdueOnly,
    sortBy: f.sortBy,
    sortDescending: true,
  };
}

/** An amount on one line, so a money column never wraps and its figures line up on the right. */
function Money({ value, color, bold }: { value: string; color?: string; bold?: boolean }) {
  return (
    <Typography variant="body2" noWrap color={color} fontWeight={bold ? 600 : undefined}>
      {value}
    </Typography>
  );
}

const columns: Column<InvoiceListItem>[] = [
  {
    key: 'invoiceNumber',
    header: 'Invoice',
    width: '24%',
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
  {
    key: 'invoiceType',
    header: 'Type',
    width: '9%',
    render: (i) => <Chip label={i.invoiceType} size="small" variant="outlined" />,
  },
  {
    key: 'grossAmount',
    header: 'Gross',
    align: 'right',
    width: '11%',
    render: (i) => <Money value={compactCurrency(i.grossAmount)} />,
  },
  {
    key: 'approvedDeductionAmount',
    header: 'Deduction',
    align: 'right',
    width: '11%',
    render: (i) =>
      i.approvedDeductionAmount > 0 ? (
        <Money value={compactCurrency(i.approvedDeductionAmount)} color="error.main" />
      ) : (
        <Money value="—" color="text.disabled" />
      ),
  },
  {
    key: 'netPayableAmount',
    header: 'Net Payable',
    align: 'right',
    width: '12%',
    render: (i) => <Money value={compactCurrency(i.netPayableAmount)} bold />,
  },
  {
    key: 'pendingWith',
    header: 'Pending with',
    width: '13%',
    render: (i) =>
      i.pendingWith ? (
        <Chip label={i.pendingWith} size="small" color="warning" variant="outlined" />
      ) : (
        <Typography variant="caption" color="text.disabled">
          —
        </Typography>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '20%',
    // Once sent in a Sanction Order the invoice shows that order's status, exactly as the Sanction
    // Orders screen does; before that, its own status.
    render: (i) =>
      i.sanctionOrderState ? (
        <SanctionOrderStatusChip
          uniform
          state={i.sanctionOrderState}
          code={i.sanctionOrderResponseCode}
          text={i.sanctionOrderStatusText}
        />
      ) : (
        <StatusChip status={i.status} sx={{ width: 200, maxWidth: '100%' }} />
      ),
  },
];

export function InvoicesPage() {
  const { can, isVendor } = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [pendingWith, setPendingWith] = useState('');
  const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Vendor claims, technical certification and finance settlement"
        icon={<ReceiptLong />}
        actions={
          can(Permissions.invoiceCreate) && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
              New invoice
            </Button>
          )
        }
      />
      <DataTable
        queryKey={['invoices', pendingOnly, pendingWith, advanced]}
        fetcher={invoicesApi.list}
        columns={isVendor ? columns.filter((c) => c.key !== 'pendingWith') : columns}
        rowKey={(i) => i.id}
        onRowClick={(i) => navigate(`/invoices/${i.id}`)}
        searchPlaceholder="Search by number, vendor, purchase/work order…"
        extraParams={{
          ...(pendingOnly ? { pendingWithMe: true } : {}),
          ...(pendingWith ? { pendingWithUserId: pendingWith } : {}),
          ...toInvoiceParams(advanced),
        }}
        filters={
          !isVendor && (
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <PendingWithMeToggle value={pendingOnly} onChange={setPendingOnly} />
              <PendingWithFilter value={pendingWith} onChange={setPendingWith} entityType={2} />
              <AdvancedSearchPanel
                filters={advanced}
                onChange={setAdvanced}
                statusOptions={INVOICE_STATUS_OPTIONS}
                categoryOptions={INVOICE_TYPE_OPTIONS}
                categoryLabel="Invoice type"
                overdueLabel="Overdue only"
                sortOptions={INVOICE_SORT_OPTIONS}
              />
            </Stack>
          )
        }
      />
      <SubmitInvoiceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const invoiceId = id ?? null;
  const [tab, setTab] = useState(0);
  const { can, user, isVendor, isInRole } = useAuth();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoicesApi.get(invoiceId!),
    enabled: !!invoiceId,
  });
  const context = useQuery({
    queryKey: ['invoice-context', invoiceId],
    queryFn: () => invoicesApi.reviewContext(invoiceId!),
    enabled: !!invoiceId,
  });
  const payments = useQuery({
    queryKey: ['invoice', invoiceId, 'payments'],
    queryFn: () => invoicesApi.payments(invoiceId!),
    enabled: !!invoiceId,
  });

  // The review action is offered to the Approver the current step is actually pending with —
  // the backend requires the caller to personally hold the pending task, so showing the button
  // to anyone else only leads to a "no pending task" error on submit — or to a Tenant/Super
  // Admin, who the backend lets act on any invoice's task regardless of assignee (the same
  // override already available for contracts and work orders, needed to clear a task stuck on
  // a step nobody with review rights can act on).
  const isMyTurn = !!data?.pendingWithUserId && data.pendingWithUserId === user?.id;
  const isAdminOverride = isInRole(RoleCodes.TenantAdmin) || isInRole(RoleCodes.SuperAdmin);

  // The single review action applies whenever the invoice is awaiting it and it's my turn.
  const canReview =
    !!data &&
    (isMyTurn || isAdminOverride) &&
    ['Submitted', 'UnderTechnicalReview', 'Resubmitted'].includes(data.status) &&
    can(Permissions.invoiceReview);

  // A Return leaves the invoice OnHold with no reviewer to act on it — whoever could raise
  // it (the vendor, or the internal Creator) corrects and sends it back in. A vendor can
  // only ever load their own invoice here (the query itself is vendor-scoped), so no extra
  // ownership check is needed on top of the permission.
  const canResubmit = !!data && data.status === 'OnHold' && can(Permissions.invoiceResubmit);

  // Correct is narrower than Review: only the exact person the review is pending with right
  // now may fix a mistake in place — not an admin, not anyone else, and never once they have
  // already acted on it. Unlike Review, there is no admin override here by design.
  const canCorrect =
    !!data &&
    isMyTurn &&
    ['Submitted', 'UnderTechnicalReview', 'Resubmitted'].includes(data.status) &&
    can(Permissions.invoiceUpdate);

  // Three tabs, not six: Details (facts + tax), Review (deductions, payments, SLA compliance
  // and the officer review context in one place) and Activity (approval progress + audit
  // trail). Activity is internal — hidden from vendors.
  const invoiceTabs = (
    [
      { key: 'details', label: 'Details' },
      { key: 'review', label: 'Review' },
      { key: 'activity', label: 'Activity', officerOnly: true },
    ] as { key: string; label: string; officerOnly?: boolean }[]
  ).filter((t) => !(isVendor && t.officerOnly));
  const activeKey = invoiceTabs[Math.min(tab, invoiceTabs.length - 1)]?.key;

  return (
    <DetailPageShell listLabel="Invoices" listRoute="/invoices" current={data?.invoiceNumber ?? 'Invoice'}>
      {isLoading || !data ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Identity + status summary card, above the tabs. */}
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 2 }}>
            <Stack direction="row" spacing={1.75} alignItems="center">
              <Avatar
                variant="rounded"
                sx={{
                  width: 48,
                  height: 48,
                  fontSize: 16,
                  fontWeight: 800,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                  color: 'primary.main',
                }}
              >
                {initials(data.vendorName)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                  {data.invoiceNumber}
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {data.vendorName}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  <DocumentLink type="WorkOrder" entityId={data.workOrderId} reference={data.workOrderNumber} bold={false} />
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="center" flexWrap="wrap" useFlexGap>
              {/* The invoice's own lifecycle status — distinct from the approval workflow's
                  status shown lower down under "Approval progress". */}
              <StatusChip status={data.status} />
              <Chip label={data.invoiceType} size="small" variant="outlined" />
              {data.billingPeriodLabel && (
                <Chip label={`Period: ${data.billingPeriodLabel}`} size="small" color="info" variant="outlined" />
              )}
              {data.milestoneName && (
                <Chip label={`Milestone: ${data.milestoneName}`} size="small" color="info" variant="outlined" />
              )}
              {data.slaCompliances && data.slaCompliances.length > 0 && (
                (() => {
                  const nonCompliant = data.slaCompliances.filter((s) => s.complianceStatus === 'NonCompliant').length;
                  return (
                    <Chip
                      label={nonCompliant > 0 ? `SLA: ${nonCompliant} non-compliant` : 'SLA: Compliant'}
                      size="small"
                      color={nonCompliant > 0 ? 'error' : 'success'}
                      variant="outlined"
                    />
                  );
                })()
              )}
              {canReview && (
                <Button size="small" variant="contained" onClick={() => setReviewOpen(true)}>
                  Review
                </Button>
              )}
              {canCorrect && (
                <Button size="small" variant="outlined" onClick={() => setCorrectOpen(true)}>
                  Correct
                </Button>
              )}
              {canResubmit && (
                <Button size="small" variant="contained" onClick={() => setResubmitOpen(true)}>
                  Correct &amp; resubmit
                </Button>
              )}
            </Stack>

            <Divider sx={{ my: 2 }} />
            {/* The money summary: gross, the deduction, and net payable. */}
            <Grid container spacing={1.5}>
              <Grid size={4}>
                <Metric label="Gross" value={compactCurrency(data.grossAmount)} />
              </Grid>
              <Grid size={4}>
                <Metric label="Deduction" value={`−${compactCurrency(data.approvedDeductionAmount)}`} tone="error" />
              </Grid>
              <Grid size={4}>
                <Metric label="Net Payable" value={compactCurrency(data.netPayableAmount)} tone="success" />
              </Grid>
            </Grid>
          </Paper>

          <Tabs
            value={Math.min(tab, invoiceTabs.length - 1)}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {invoiceTabs.map((t) => (
              <Tab key={t.key} label={t.label} />
            ))}
          </Tabs>
          <Divider sx={{ mb: 1 }} />

          {/* Tab content — the page itself scrolls. */}
          <Box sx={{ mt: 1 }}>
          {/* DETAILS — the invoice's own facts and tax breakdown, in tidy grouped cards. */}
          {activeKey === 'details' && (
            <Box sx={{ pt: 2 }}>
              <FactCard title="Invoice">
                <FactRow label="Vendor invoice #" value={data.vendorInvoiceNumber} />
                <FactRow label="Invoice date" value={date(data.vendorInvoiceDate)} />
                {data.submittedOn && <FactRow label="Submitted" value={date(data.submittedOn)} />}
                {data.dueDate && <FactRow label="Due" value={date(data.dueDate)} />}
                <FactRow label="Department" value={data.departmentName} />
                <FactRow label="Type" value={data.invoiceType} />
                {data.billingPeriodLabel && <FactRow label="Billing period" value={data.billingPeriodLabel} />}
                {data.milestoneName && <FactRow label="Milestone" value={data.milestoneName} />}
              </FactCard>

              <FactCard title="Amount breakdown" mt={2}>
                <FactRow label="Base amount" value={currency(data.baseAmount)} />
                <FactRow label="CGST" value={currency(data.cgstAmount)} />
                <FactRow label="SGST" value={currency(data.sgstAmount)} />
                <FactRow label="IGST" value={currency(data.igstAmount)} />
                <FactRow label="Total tax" value={currency(data.totalTaxAmount)} />
                <FactRow label="Gross" value={currency(data.grossAmount)} strong />
                <FactRow label="Deduction" value={`−${currency(data.approvedDeductionAmount)}`} tone="error" />
                <FactRow label="Net payable" value={currency(data.netPayableAmount)} strong tone="success" />
                <FactRow label="Paid" value={currency(data.paidAmount)} />
              </FactCard>

              {/* Officer commentary — not shown to vendors. */}
              {!isVendor && (data.technicalRemarks || data.financeRemarks) && (
                <FactCard title="Officer remarks" mt={2}>
                  {data.technicalRemarks && <FactRow label="Technical" value={data.technicalRemarks} wrap />}
                  {data.financeRemarks && <FactRow label="Finance" value={data.financeRemarks} wrap />}
                </FactCard>
              )}

              <FactCard title="Attachments" mt={2}>
                <DocumentAttachments ownerType="Invoice" ownerId={data.id} />
              </FactCard>
            </Box>
          )}

          {/* REVIEW — everything the settlement rests on, in one place: deductions, the
              payment record, the recorded SLA-compliance verdicts, and the officer review
              context. Deductions and payments are visible to vendors; the SLA verdicts and
              review context are officer-only. */}
          {activeKey === 'review' && (
            <Box sx={{ pt: 2 }}>
              {/* — Deductions — */}
              <TabSectionTitle icon={<TrendingDown fontSize="small" />} title="Deductions" />
              {!isVendor && (
                <>
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    <Chip
                      icon={<Gavel fontSize="small" />}
                      label={`Technical recommended: ${compactCurrency(data.recommendedDeductionAmount)}`}
                      size="small"
                      color="info"
                      variant="outlined"
                    />
                    {data.financeOverrideReason && (
                      <Chip
                        icon={<AccountBalance fontSize="small" />}
                        label="Finance overrode"
                        size="small"
                        color="warning"
                      />
                    )}
                  </Stack>
                  {data.certifiedWorkPercentage != null && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Certified progress: {data.certifiedWorkPercentage}%
                    </Typography>
                  )}
                  {data.financeOverrideReason && (
                    <Paper sx={{ p: 1.5, mb: 1.5, bgcolor: 'action.hover' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        OVERRIDE REASON
                      </Typography>
                      <Typography variant="body2">{data.financeOverrideReason}</Typography>
                    </Paper>
                  )}
                </>
              )}

              {data.deductions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No deductions applied.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {data.deductions.map((d) => (
                    <Box
                      key={d.id}
                      sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', borderLeft: (t) => `3px solid ${t.palette.error.main}` }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700}>
                            {d.description}
                          </Typography>
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                            <Chip label={d.deductionType} size="small" />
                            {d.isRecommendation && <Chip label="Recommendation" size="small" color="info" />}
                            {d.isApproved && <Chip label="Approved" size="small" color="success" />}
                            {d.isSystemGenerated && <Chip label="Rule" size="small" variant="outlined" />}
                          </Stack>
                        </Box>
                        <Typography variant="subtitle2" color="error.main" fontWeight={800} sx={{ whiteSpace: 'nowrap' }}>
                          − {currency(d.amount)}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}

              {/* — Payments — */}
              <TabSectionTitle icon={<Payments fontSize="small" />} title="Payments" mt={3} />
              <Stack direction="row" spacing={2} sx={{ mb: 1.5 }} alignItems="center">
                <Metric label="Net payable" value={compactCurrency(data.netPayableAmount)} />
                <Metric label="Paid" value={compactCurrency(data.paidAmount)} tone="success" />
                <Metric label="Outstanding" value={compactCurrency(data.netPayableAmount - data.paidAmount)} />
              </Stack>
              {payments.isLoading ? (
                <Typography variant="caption" color="text.secondary">
                  Loading…
                </Typography>
              ) : (payments.data ?? []).length === 0 ? (
                <Alert severity="info">
                  No payment has been recorded for this invoice yet.
                </Alert>
              ) : (
                <Stack spacing={1.25}>
                  {payments.data!.map((p) => {
                    const meta = (
                      [
                        ['Mode', p.paymentMode],
                        ['Reference', p.referenceNumber],
                        ['Bank', p.bankName],
                        ['Instrument', p.instrumentDate ? date(p.instrumentDate) : null],
                        [
                          p.disbursedOn ? 'Paid on' : 'Dated',
                          p.disbursedOn ? date(p.disbursedOn) : p.scheduledDate ? date(p.scheduledDate) : null,
                        ],
                        ['Advice', p.adviceNumber],
                      ] as [string, string | null | undefined][]
                    ).filter((r): r is [string, string] => !!r[1]);
                    return (
                      <Box
                        key={p.id}
                        sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', borderLeft: (t) => `3px solid ${t.palette.success.main}` }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={1}
                          sx={{ mb: meta.length ? 1 : 0 }}
                        >
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Typography variant="subtitle2" fontWeight={800} color="success.main">
                              {currency(p.amount)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {p.paymentNumber}
                            </Typography>
                            {p.isManualEntry && <Chip label="Manual" size="small" variant="outlined" />}
                          </Stack>
                          <StatusChip status={p.status} />
                        </Stack>
                        {meta.length > 0 && (
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1.25 }}>
                            {meta.map(([label, value]) => (
                              <Box key={label}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  display="block"
                                  sx={{ textTransform: 'uppercase', letterSpacing: 0.4, fontSize: '0.62rem', fontWeight: 700 }}
                                >
                                  {label}
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                  {value}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              )}

              {/* — Officer review context: contract, work order, previous claims (officer-only) — */}
              {!isVendor && (
                <Box sx={{ mt: 3 }}>
                  <InvoiceReviewContextPanel data={context.data} loading={context.isLoading} />
                </Box>
              )}

              {/* — SLA & penalty commitments, with the recorded compliance verdict inline
                    (officer-only). One unified section — no separate commitments/compliance lists. */}
              {!isVendor && ((context.data?.slas?.length ?? 0) > 0 || (data.slaCompliances ?? []).length > 0) && (
                <>
                  <TabSectionTitle
                    icon={<Gavel fontSize="small" />}
                    title={`SLA & penalty commitments (${context.data?.slas?.length ?? 0})`}
                    mt={3}
                  />
                  <SlaPanel definitions={context.data?.slas ?? []} verdicts={data.slaCompliances ?? []} />
                </>
              )}
            </Box>
          )}

          {/* ACTIVITY — where the invoice stands in its approval, then the full audit trail. */}
          {activeKey === 'activity' && (
            <Box sx={{ pt: 2 }}>
              {/* One timeline: approval levels, then settlement → Sanction Order → Payment Order →
                  disbursement → payment → UTR, each with its history; full audit list on demand. */}
              <InvoiceActivityTimeline invoiceId={data.id} />
            </Box>
          )}
          </Box>

          <InvoiceReviewDialog
            invoice={data}
            open={reviewOpen}
            capturesSlaCompliance={context.data?.capturesSlaComplianceAtCurrentStep ?? false}
            slaLines={context.data?.slas ?? []}
            onClose={() => setReviewOpen(false)}
          />
          <ResubmitInvoiceDialog invoice={data} open={resubmitOpen} mode="resubmit" onClose={() => setResubmitOpen(false)} />
          <ResubmitInvoiceDialog invoice={data} open={correctOpen} mode="correct" onClose={() => setCorrectOpen(false)} />
        </>
      )}
    </DetailPageShell>
  );
}

/** Aggregated context an officer sees while reviewing an invoice. */
function InvoiceReviewContextPanel({ data, loading }: { data?: InvoiceReviewContext; loading: boolean }) {
  if (loading || !data) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  const c = data.contract;
  const w = data.workOrder;
  return (
    <Stack spacing={2}>
      {c && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
            <Description fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={800}>
              Contract
            </Typography>
          </Stack>
          <Typography variant="body2" fontWeight={600}>
            {c.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" component="div">
            <DocumentLink type="Contract" entityId={c.id} reference={c.contractNumber} bold={false} /> ·{' '}
            {c.vendorName}
            {c.gstin ? ` · GSTIN ${c.gstin}` : ''}
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            <Metric label="Value" value={compactCurrency(c.contractValue)} />
            <Metric label="Committed" value={compactCurrency(c.committedValue)} />
            <Metric label="Available" value={compactCurrency(c.availableValue)} />
            <Box><StatusChip status={c.status} /></Box>
          </Stack>
        </Paper>
      )}

      {w && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
            <Assignment fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={800}>
              Purchase Order / Work Order
            </Typography>
          </Stack>
          <Typography variant="body2" fontWeight={600}>
            {w.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" component="div">
            <DocumentLink type="WorkOrder" entityId={w.id} reference={w.workOrderNumber} bold={false} />
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            <Metric label="Value" value={compactCurrency(w.totalAmount)} />
            <Metric label="Invoiced" value={compactCurrency(w.invoicedAmount)} />
            <Metric label="Billable left" value={compactCurrency(w.billableBalance)} />
            <Box><StatusChip status={w.status} /></Box>
          </Stack>
          {w.paymentScheduleType && w.paymentScheduleType !== 'OneTime' && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Billing schedule: <b>{w.paymentScheduleType}</b> · active {date(w.startDate)} – {date(w.expectedCompletionDate)}.
              Confirm this claim's period/milestone matches.
            </Typography>
          )}
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Stack direction="row" spacing={0.75} alignItems="center">
            <History fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={800}>
              Previous claims on this purchase order / work order ({data.previousInvoices.length})
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Paid so far {compactCurrency(data.previouslyPaid)} · claimed {compactCurrency(data.previouslyClaimed)}
          </Typography>
        </Stack>
        {data.previousInvoices.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This is the first claim against this purchase order / work order.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mt: 1 }}>
            {data.previousInvoices.map((p) => (
              <Box
                key={p.id}
                sx={{ p: 1.25, borderRadius: 1, border: (t) => `1px solid ${t.palette.divider}` }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} component="div">
                      <DocumentLink type="Invoice" entityId={p.id} reference={p.invoiceNumber} bold={false} />
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {p.vendorInvoiceNumber}
                      {p.submittedOn ? ` · ${date(p.submittedOn)}` : ''}
                    </Typography>
                  </Box>
                  <StatusChip status={p.status} />
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Gross {compactCurrency(p.grossAmount)} · net {compactCurrency(p.netPayableAmount)} · paid{' '}
                  {compactCurrency(p.paidAmount)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
      {/* SLA commitments used to be repeated here; they now live in the single unified
          "SLA & penalty commitments" section in the Review tab, alongside each verdict. */}
    </Stack>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'error' | 'success' }) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 1.75, textAlign: 'center', borderRadius: 2, bgcolor: 'action.hover', border: (t) => `1px solid ${t.palette.divider}` }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.64rem', fontWeight: 600, display: 'block' }}
      >
        {label}
      </Typography>
      <Typography variant="subtitle1" fontWeight={800} color={tone ? `${tone}.main` : 'text.primary'} sx={{ mt: 0.25 }}>
        {value}
      </Typography>
    </Paper>
  );
}

/** A titled card wrapping a set of label/value rows, used across the Details tab. */
function FactCard({ title, children, mt }: { title: string; children: React.ReactNode; mt?: number }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        mt,
        borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
        boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.05)',
      }}
    >
      <Typography
        variant="overline"
        sx={{ fontWeight: 800, letterSpacing: 0.8, color: 'text.primary' }}
      >
        {title}
      </Typography>
      <Stack divider={<Divider flexItem />} sx={{ mt: 0.75 }}>
        {children}
      </Stack>
    </Paper>
  );
}

/** One aligned label/value row inside a FactCard. */
function FactRow({
  label,
  value,
  strong,
  tone,
  wrap,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'error' | 'success';
  wrap?: boolean;
}) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems={wrap ? 'flex-start' : 'center'}
      spacing={2}
      sx={{ py: 0.85 }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={strong ? 700 : 500}
        color={tone ? `${tone}.main` : 'text.primary'}
        sx={{ textAlign: 'right', whiteSpace: wrap ? 'normal' : 'nowrap' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

/** A small section heading used inside the consolidated Review tab. */
function TabSectionTitle({ icon, title, mt }: { icon: React.ReactNode; title: string; mt?: number }) {
  return (
    <Box sx={{ mt }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
        <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
        <Typography variant="overline" fontWeight={800} sx={{ letterSpacing: 0.8, lineHeight: 1 }}>
          {title}
        </Typography>
      </Stack>
      <Divider sx={{ mb: 1.5 }} />
    </Box>
  );
}

/**
 * One SLA section that unifies the contract / work-order SLA commitments with the officer's
 * recorded compliance verdicts — so each SLA's terms appear once, not duplicated across a
 * separate "commitments" list and a "compliance" list. Every card shows the SLA's terms and,
 * where a verdict has been recorded, the Compliant / Non-compliant chip, the breach reason and
 * who recorded it.
 */
function SlaPanel({
  definitions,
  verdicts,
}: {
  definitions: InvoiceReviewContext['slas'];
  verdicts: InvoiceDetail['slaCompliances'];
}) {
  const v = verdicts ?? [];
  // Every commitment, plus any recorded verdict that has no matching commitment line.
  const rows = [
    ...definitions.map((def) => ({ def, verdict: v.find((x) => x.metric === def.metric) })),
    ...v
      .filter((x) => !definitions.some((d) => d.metric === x.metric))
      .map((verdict) => ({ def: undefined as (typeof definitions)[number] | undefined, verdict })),
  ];

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No SLA commitments recorded on the contract.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {rows.map(({ def, verdict }, i) => {
        const metric = def?.metric ?? verdict?.metric ?? 'SLA';
        const compliant = verdict?.complianceStatus === 'Compliant';
        const per = def?.penaltyPeriod
          ? ({ Days: 'day', Weekly: 'week', Monthly: 'month', Yearly: 'year' } as Record<string, string>)[def.penaltyPeriod] ??
            def.penaltyPeriod.toLowerCase()
          : '';
        const penaltyRate = def
          ? (def.deductionType === 'Percentage' ? `${def.deductionValue}%` : currency(def.deductionValue)) + (per ? ` / ${per}` : '')
          : '';
        return (
          <Box
            key={i}
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'action.hover',
              borderLeft: (t) =>
                `3px solid ${verdict ? (compliant ? t.palette.success.main : t.palette.error.main) : t.palette.warning.main}`,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700}>
                  {metric}
                </Typography>
                {def && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                    {def.measurementPeriod}
                    {def.targetValue ? ` · target ${def.targetValue}` : ''}
                  </Typography>
                )}
              </Box>
              <Stack alignItems="flex-end" spacing={0.75} sx={{ flexShrink: 0 }}>
                {verdict && (
                  <Chip
                    size="small"
                    label={compliant ? 'Compliant' : 'Non-compliant'}
                    color={compliant ? 'success' : 'error'}
                    variant={compliant ? 'outlined' : 'filled'}
                  />
                )}
                {def && (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography
                      variant="caption"
                      sx={{ textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, fontSize: '0.58rem', color: 'warning.main' }}
                    >
                      Penalty deduction
                    </Typography>
                    <Typography variant="body2" fontWeight={800} color="warning.main" sx={{ whiteSpace: 'nowrap' }}>
                      {penaltyRate}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Stack>
            {def?.failureCondition && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                Deducted when: {def.failureCondition}
              </Typography>
            )}
            {verdict && !compliant && verdict.nonComplianceReason && (
              <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.5 }}>
                Non-compliance: {verdict.nonComplianceReason}
              </Typography>
            )}
            {verdict?.reviewedByName && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                Recorded by <b>{verdict.reviewedByName}</b>
                {verdict.reviewedByDesignation ? `, ${verdict.reviewedByDesignation}` : ''}
                {verdict.reviewedOn ? ` · ${date(verdict.reviewedOn)}` : ''}
              </Typography>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
