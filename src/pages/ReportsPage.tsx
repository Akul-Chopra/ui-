import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Assessment,
  Payments,
  Groups,
  EventBusy,
  AccountBalanceWallet,
  HourglassBottom,
  ReceiptLong,
  MilitaryTech,
  Inventory,
  Speed,
  Store,
  EmojiEvents,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { PageHeader } from '@/components/PageHeader';
import { DocumentLink } from '@/components/DocumentLink';
import { reportsApi } from '@/api/endpoints';
import type { PaymentSummaryGrouping } from '@/api/types';
import { compactCurrency, currency, number as fmtNumber, date as fmtDate } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';
import { PaymentQueueTable } from '@/components/PaymentQueueTable';

/** A thin wrapper that shows a spinner while loading and an empty note when there are no rows. */
function ReportBody({
  isLoading,
  isEmpty,
  emptyText,
  children,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (isEmpty) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        {emptyText}
      </Typography>
    );
  }
  return <>{children}</>;
}

// ---- Approval performance --------------------------------------------------

function ApprovalPerformanceReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'approval-performance'],
    queryFn: reportsApi.approvalPerformance,
  });
  const rows = data ?? [];
  return (
    <ReportBody isLoading={isLoading} isEmpty={rows.length === 0} emptyText="No approval activity yet.">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Officer</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">Pending</TableCell>
              <TableCell align="right">Overdue</TableCell>
              <TableCell align="right">Cleared (month)</TableCell>
              <TableCell align="right">Cleared (6 mo)</TableCell>
              <TableCell align="right">Avg turnaround</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.officer} hover>
                <TableCell>{r.officer}</TableCell>
                <TableCell>
                  {r.role ? <Chip size="small" label={r.role} variant="outlined" /> : '—'}
                </TableCell>
                <TableCell align="right">{fmtNumber(r.pending)}</TableCell>
                <TableCell align="right">
                  {r.overdue > 0 ? (
                    <Chip size="small" color="error" label={fmtNumber(r.overdue)} />
                  ) : (
                    '0'
                  )}
                </TableCell>
                <TableCell align="right">{fmtNumber(r.clearedThisMonth)}</TableCell>
                <TableCell align="right">{fmtNumber(r.clearedLast6Months)}</TableCell>
                <TableCell align="right">
                  {r.avgTurnaroundHours != null ? `${fmtNumber(r.avgTurnaroundHours)} h` : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </ReportBody>
  );
}

// ---- Contract expiry -------------------------------------------------------

const EXPIRY_TONE: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  Expired: 'error',
  'Within 30 days': 'error',
  'Within 60 days': 'warning',
  'Within 90 days': 'warning',
  'Within 180 days': 'info',
};

function ContractExpiryReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'contract-expiry'],
    queryFn: reportsApi.contractExpiry,
  });
  const rows = data ?? [];
  return (
    <ReportBody
      isLoading={isLoading}
      isEmpty={rows.length === 0}
      emptyText="No active contracts expire within the next 180 days."
    >
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Contract</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Department</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell align="right">Available</TableCell>
              <TableCell align="right">Days left</TableCell>
              <TableCell>Window</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>
                  <Stack>
                    <DocumentLink type="Contract" entityId={r.id} reference={r.contractNumber} />
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {r.title}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>{r.vendorName}</TableCell>
                <TableCell>{r.departmentName ?? '—'}</TableCell>
                <TableCell align="right">{compactCurrency(r.contractValue)}</TableCell>
                <TableCell align="right">{compactCurrency(r.availableValue)}</TableCell>
                <TableCell align="right">
                  {r.daysToExpiry < 0 ? `${Math.abs(r.daysToExpiry)} overdue` : r.daysToExpiry}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={r.bucket} color={EXPIRY_TONE[r.bucket] ?? 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </ReportBody>
  );
}

// ---- Payment summary -------------------------------------------------------

const GROUPINGS: { value: PaymentSummaryGrouping; label: string }[] = [
  { value: 'Vendor', label: 'By vendor' },
  { value: 'Department', label: 'By department' },
  { value: 'Month', label: 'By month' },
  { value: 'ContractCategory', label: 'By category' },
];

function PaymentSummaryReportView() {
  const [groupBy, setGroupBy] = useState<PaymentSummaryGrouping>('Vendor');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'payment-summary', groupBy, fromDate, toDate],
    queryFn: () =>
      reportsApi.paymentSummary({ groupBy, fromDate: fromDate || undefined, toDate: toDate || undefined }),
  });
  const rows = data?.rows ?? [];
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField
          select
          size="small"
          label="Group by"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as PaymentSummaryGrouping)}
          sx={{ minWidth: 180 }}
        >
          {GROUPINGS.map((g) => (
            <MenuItem key={g.value} value={g.value}>
              {g.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          size="small"
          label="From"
          InputLabelProps={{ shrink: true }}
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <TextField
          type="date"
          size="small"
          label="To"
          InputLabelProps={{ shrink: true }}
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        {(fromDate || toDate) && (
          <Button size="small" onClick={() => { setFromDate(''); setToDate(''); }}>
            Clear dates
          </Button>
        )}
      </Stack>
      <ReportBody
        isLoading={isLoading}
        isEmpty={rows.length === 0}
        emptyText="No payment activity for this financial year."
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{GROUPINGS.find((g) => g.value === groupBy)?.label.replace('By ', '')}</TableCell>
                <TableCell align="right">Invoices</TableCell>
                <TableCell align="right">Gross</TableCell>
                <TableCell align="right">Deductions</TableCell>
                <TableCell align="right">Net payable</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Outstanding</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.groupId ?? r.groupName} hover>
                  <TableCell>{r.groupName}</TableCell>
                  <TableCell align="right">{fmtNumber(r.invoiceCount)}</TableCell>
                  <TableCell align="right">{currency(r.grossAmount)}</TableCell>
                  <TableCell align="right">{currency(r.deductionAmount)}</TableCell>
                  <TableCell align="right">{currency(r.netPayableAmount)}</TableCell>
                  <TableCell align="right">{currency(r.paidAmount)}</TableCell>
                  <TableCell align="right">{currency(r.outstandingAmount)}</TableCell>
                </TableRow>
              ))}
              {data?.totals && (
                <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid', borderColor: 'divider' } }}>
                  <TableCell>Total</TableCell>
                  <TableCell align="right">{fmtNumber(data.totals.invoiceCount)}</TableCell>
                  <TableCell align="right">{currency(data.totals.grossAmount)}</TableCell>
                  <TableCell align="right">{currency(data.totals.deductionAmount)}</TableCell>
                  <TableCell align="right">{currency(data.totals.netPayableAmount)}</TableCell>
                  <TableCell align="right">{currency(data.totals.paidAmount)}</TableCell>
                  <TableCell align="right">{currency(data.totals.outstandingAmount)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </ReportBody>
    </Stack>
  );
}

// ---- Ageing ----------------------------------------------------------------

const AGEING_TONE: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  '0-30 days': 'success',
  '31-60 days': 'info',
  '61-90 days': 'warning',
  'Over 90 days': 'error',
};

function AgeingReportView() {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'ageing'],
    queryFn: () => reportsApi.ageing(),
  });
  const invoices = data?.invoices ?? [];
  return (
    <Stack spacing={2}>
      {data && data.buckets.length > 0 && (
        <Stack direction="row" spacing={2} flexWrap="wrap">
          {data.buckets.map((b) => (
            <Card key={b.bucket} variant="outlined" sx={{ minWidth: 170, flex: '1 1 160px' }}>
              <CardContent>
                <Chip size="small" label={b.bucket} color={AGEING_TONE[b.bucket] ?? 'default'} />
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {compactCurrency(b.outstandingAmount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {b.count} invoice{b.count === 1 ? '' : 's'}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      <ReportBody
        isLoading={isLoading}
        isEmpty={invoices.length === 0}
        emptyText="No outstanding invoices — nothing is ageing."
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Department</TableCell>
                <TableCell align="right">Outstanding</TableCell>
                <TableCell align="right">Age (days)</TableCell>
                <TableCell>Bucket</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((r) => (
                <TableRow key={r.invoiceId} hover>
                  <TableCell>
                    <DocumentLink type="Invoice" entityId={r.invoiceId} reference={r.invoiceNumber} />
                  </TableCell>
                  <TableCell>{r.vendorName}</TableCell>
                  <TableCell>{r.departmentName}</TableCell>
                  <TableCell align="right">{currency(r.outstandingAmount)}</TableCell>
                  <TableCell align="right">{r.ageInDays}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.bucket} color={AGEING_TONE[r.bucket] ?? 'default'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </ReportBody>
    </Stack>
  );
}

// ---- Tax & deductions ------------------------------------------------------

function TaxDeductionReportView() {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'tax-deduction'],
    queryFn: () => reportsApi.taxDeduction(),
  });
  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (!data) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No statutory figures for this financial year.
      </Typography>
    );
  }
  const tiles = [
    { label: 'GST collected', value: data.totalGst },
    { label: 'Total deductions', value: data.totalDeductions },
    { label: 'MSME disbursed', value: data.msmePaidAmount },
    { label: 'Non-MSME disbursed', value: data.nonMsmePaidAmount },
  ];
  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        {tiles.map((t) => (
          <Card key={t.label} variant="outlined" sx={{ minWidth: 190, flex: '1 1 180px' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                {t.label}
              </Typography>
              <Typography variant="h6">{compactCurrency(t.value)}</Typography>
            </CardContent>
          </Card>
        ))}
        <Card variant="outlined" sx={{ minWidth: 190, flex: '1 1 180px' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              MSME share of disbursement
            </Typography>
            <Typography variant="h6">{data.msmeSharePercent}%</Typography>
          </CardContent>
        </Card>
      </Stack>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          GST breakdown
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell>CGST</TableCell>
                <TableCell align="right">{currency(data.totalCgst)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>SGST</TableCell>
                <TableCell align="right">{currency(data.totalSgst)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>IGST</TableCell>
                <TableCell align="right">{currency(data.totalIgst)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {data.deductionsByType.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Deductions by type
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.deductionsByType.map((d) => (
                  <TableRow key={d.deductionType} hover>
                    <TableCell>{d.deductionTypeName}</TableCell>
                    <TableCell align="right">{fmtNumber(d.count)}</TableCell>
                    <TableCell align="right">{currency(d.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Stack>
  );
}

// ---- Officer scorecard (workload-adjusted SLA) -----------------------------

function scoreTone(v: number): 'success' | 'info' | 'warning' | 'error' {
  if (v >= 85) return 'success';
  if (v >= 70) return 'info';
  if (v >= 50) return 'warning';
  return 'error';
}

function OfficerScorecardReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'officer-scorecard'],
    queryFn: reportsApi.officerScorecard,
  });
  const rows = data ?? [];
  return (
    <Stack spacing={2}>
      <Alert severity="info" variant="outlined">
        The <strong>Adjusted score</strong> ranks officers fairly across different workloads. A
        light desk that cleared one task on time is pulled toward the group average, while a busy
        desk that sustained a high on-time rate keeps its standing — so volume is rewarded, not
        penalised. Raw SLA % is shown alongside for transparency.
      </Alert>
      <ReportBody isLoading={isLoading} isEmpty={rows.length === 0} emptyText="No approval activity yet.">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Officer</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="right">Workload</TableCell>
                <TableCell align="right">On-time</TableCell>
                <TableCell align="right">Late</TableCell>
                <TableCell align="right">Overdue</TableCell>
                <TableCell align="right">Raw SLA %</TableCell>
                <TableCell align="right">Avg turnaround</TableCell>
                <TableCell align="right" sx={{ minWidth: 160 }}>
                  Adjusted score
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.officer} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{r.officer}</TableCell>
                  <TableCell>
                    {r.role ? <Chip size="small" label={r.role} variant="outlined" /> : '—'}
                  </TableCell>
                  <TableCell align="right">{fmtNumber(r.workload)}</TableCell>
                  <TableCell align="right">{fmtNumber(r.onTime)}</TableCell>
                  <TableCell align="right">{fmtNumber(r.late)}</TableCell>
                  <TableCell align="right">
                    {r.overduePending > 0 ? (
                      <Chip size="small" color="error" label={fmtNumber(r.overduePending)} />
                    ) : (
                      '0'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {r.slaCompliancePct != null ? `${r.slaCompliancePct}%` : '—'}
                  </TableCell>
                  <TableCell align="right">{fmtNumber(r.avgTurnaroundHours)} h</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                      <Box sx={{ width: 70 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, r.adjustedScore)}
                          color={scoreTone(r.adjustedScore)}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                      <Typography variant="body2" fontWeight={700} sx={{ minWidth: 42 }}>
                        {r.adjustedScore}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </ReportBody>
    </Stack>
  );
}

// ---- Officer workload ------------------------------------------------------

function OfficerWorkloadReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'officer-workload'],
    queryFn: reportsApi.officerWorkload,
  });
  const rows = data ?? [];
  return (
    <ReportBody isLoading={isLoading} isEmpty={rows.length === 0} emptyText="No workload recorded yet.">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Officer</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">Contracts</TableCell>
              <TableCell align="right">Purchase/Work Orders</TableCell>
              <TableCell align="right">Invoices</TableCell>
              <TableCell align="right">Payments</TableCell>
              <TableCell align="right">Total tasks</TableCell>
              <TableCell align="right">Pending</TableCell>
              <TableCell align="right">Overdue</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.officer} hover>
                <TableCell>{r.officer}</TableCell>
                <TableCell>
                  {r.role ? <Chip size="small" label={r.role} variant="outlined" /> : '—'}
                </TableCell>
                <TableCell align="right">{fmtNumber(r.contracts)}</TableCell>
                <TableCell align="right">{fmtNumber(r.workOrders)}</TableCell>
                <TableCell align="right">{fmtNumber(r.invoices)}</TableCell>
                <TableCell align="right">{fmtNumber(r.payments)}</TableCell>
                <TableCell align="right">
                  <strong>{fmtNumber(r.totalTasks)}</strong>
                </TableCell>
                <TableCell align="right">{fmtNumber(r.pending)}</TableCell>
                <TableCell align="right">
                  {r.overdue > 0 ? (
                    <Chip size="small" color="error" label={fmtNumber(r.overdue)} />
                  ) : (
                    '0'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </ReportBody>
  );
}

// ---- Officer responsiveness ------------------------------------------------

function OfficerResponsivenessReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['report', 'officer-responsiveness'],
    queryFn: reportsApi.officerResponsiveness,
  });
  const rows = data ?? [];
  return (
    <ReportBody
      isLoading={isLoading}
      isEmpty={rows.length === 0}
      emptyText="No completed approvals to measure."
    >
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Officer</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">Completed</TableCell>
              <TableCell align="right">Same day</TableCell>
              <TableCell align="right">1–3 days</TableCell>
              <TableCell align="right">3–7 days</TableCell>
              <TableCell align="right">Over a week</TableCell>
              <TableCell align="right">Avg</TableCell>
              <TableCell align="right">Slowest</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const fast = r.completed > 0 ? Math.round((r.sameDay / r.completed) * 100) : 0;
              return (
                <TableRow key={r.officer} hover>
                  <TableCell>{r.officer}</TableCell>
                  <TableCell>
                    {r.role ? <Chip size="small" label={r.role} variant="outlined" /> : '—'}
                  </TableCell>
                  <TableCell align="right">{fmtNumber(r.completed)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={`${fast}% cleared same day`}>
                      <Chip size="small" color="success" label={fmtNumber(r.sameDay)} />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">{fmtNumber(r.withinThreeDays)}</TableCell>
                  <TableCell align="right">{fmtNumber(r.withinAWeek)}</TableCell>
                  <TableCell align="right">
                    {r.overAWeek > 0 ? (
                      <Chip size="small" color="warning" label={fmtNumber(r.overAWeek)} />
                    ) : (
                      '0'
                    )}
                  </TableCell>
                  <TableCell align="right">{fmtNumber(r.avgHours)} h</TableCell>
                  <TableCell align="right">{fmtNumber(r.slowestHours)} h</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </ReportBody>
  );
}

// ---- Vendor self-service reports -------------------------------------------

/** A compact row of headline figures shared by the vendor reports. */
function SummaryTiles({ tiles }: { tiles: { label: string; value: string; tone?: 'success' | 'warning' | 'error' }[] }) {
  return (
    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
      {tiles.map((t) => (
        <Card key={t.label} variant="outlined" sx={{ minWidth: 170, flex: '1 1 160px' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">{t.label}</Typography>
            <Typography variant="h6" color={t.tone ? `${t.tone}.main` : 'text.primary'}>{t.value}</Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function VendorInvoicesReport() {
  const { data, isLoading } = useQuery({ queryKey: ['report', 'my-invoices'], queryFn: reportsApi.myInvoices });
  const rows = data?.rows ?? [];
  return (
    <Stack spacing={1}>
      {data && (
        <SummaryTiles
          tiles={[
            { label: 'Gross claimed', value: compactCurrency(data.totalGross) },
            { label: 'Deductions', value: compactCurrency(data.totalDeductions), tone: 'warning' },
            { label: 'Net payable', value: compactCurrency(data.totalNetPayable) },
            { label: 'Paid', value: compactCurrency(data.totalPaid), tone: 'success' },
            { label: 'Outstanding', value: compactCurrency(data.totalOutstanding), tone: 'error' },
          ]}
        />
      )}
      <ReportBody isLoading={isLoading} isEmpty={rows.length === 0} emptyText="You have not raised any invoices yet.">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Purchase/Work Order</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Gross</TableCell>
                <TableCell align="right">Deductions</TableCell>
                <TableCell align="right">Net payable</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Outstanding</TableCell>
                <TableCell align="right">Age</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell><DocumentLink type="Invoice" entityId={r.id} reference={r.invoiceNumber} /></TableCell>
                  <TableCell>{r.workOrderNumber ?? '—'}</TableCell>
                  <TableCell><Chip size="small" variant="outlined" label={r.status} /></TableCell>
                  <TableCell align="right">{currency(r.grossAmount)}</TableCell>
                  <TableCell align="right">{currency(r.deductionAmount)}</TableCell>
                  <TableCell align="right">{currency(r.netPayableAmount)}</TableCell>
                  <TableCell align="right">{currency(r.paidAmount)}</TableCell>
                  <TableCell align="right">{currency(r.outstandingAmount)}</TableCell>
                  <TableCell align="right">{r.ageInDays}d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </ReportBody>
    </Stack>
  );
}

function VendorPaymentsReport() {
  const { data, isLoading } = useQuery({ queryKey: ['report', 'my-payments'], queryFn: reportsApi.myPayments });
  const rows = data?.rows ?? [];
  return (
    <Stack spacing={1}>
      {data && (
        <SummaryTiles
          tiles={[
            { label: 'Received', value: compactCurrency(data.totalReceived), tone: 'success' },
            { label: 'In progress', value: compactCurrency(data.totalInProgress), tone: 'warning' },
            { label: 'Payments received', value: fmtNumber(data.disbursedCount) },
          ]}
        />
      )}
      {data && data.monthly.length > 0 && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Monthly receipts</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {data.monthly.map((m) => (
              <Chip key={m.label} label={`${m.label}: ${compactCurrency(m.amount)}`} size="small" color="success" variant="outlined" />
            ))}
          </Stack>
        </Box>
      )}
      <ReportBody isLoading={isLoading} isEmpty={rows.length === 0} emptyText="No payments have been raised to you yet.">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Payment</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Disbursed on</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.paymentNumber} hover>
                  <TableCell>{r.paymentNumber}</TableCell>
                  <TableCell><DocumentLink type="Invoice" entityId={r.invoiceId} reference={r.invoiceNumber} bold={false} /></TableCell>
                  <TableCell><Chip size="small" variant="outlined" label={r.status} /></TableCell>
                  <TableCell align="right">{currency(r.amount)}</TableCell>
                  <TableCell>{r.disbursedOn ? fmtDate(r.disbursedOn) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </ReportBody>
    </Stack>
  );
}

function VendorContractsReport() {
  const { data, isLoading } = useQuery({ queryKey: ['report', 'my-contracts'], queryFn: reportsApi.myContracts });
  const rows = data?.rows ?? [];
  return (
    <Stack spacing={1}>
      {data && (
        <SummaryTiles
          tiles={[
            { label: 'Contract value', value: compactCurrency(data.totalValue) },
            { label: 'Committed to POs/WOs', value: compactCurrency(data.totalCommitted) },
            { label: 'Disbursed', value: compactCurrency(data.totalDisbursed), tone: 'success' },
          ]}
        />
      )}
      <ReportBody isLoading={isLoading} isEmpty={rows.length === 0} emptyText="You have no contracts yet.">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Contract</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Value</TableCell>
                <TableCell align="right">Committed</TableCell>
                <TableCell align="right">Available</TableCell>
                <TableCell align="right">POs/WOs</TableCell>
                <TableCell align="right">Invoices</TableCell>
                <TableCell align="right">Expiry</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <DocumentLink type="Contract" entityId={r.id} reference={r.contractNumber} />
                    <Typography variant="caption" color="text.secondary" noWrap display="block">{r.title}</Typography>
                  </TableCell>
                  <TableCell><Chip size="small" variant="outlined" label={r.status} /></TableCell>
                  <TableCell align="right">{compactCurrency(r.contractValue)}</TableCell>
                  <TableCell align="right">{compactCurrency(r.committedValue)}</TableCell>
                  <TableCell align="right">{compactCurrency(r.availableValue)}</TableCell>
                  <TableCell align="right">{r.workOrderCount}</TableCell>
                  <TableCell align="right">{r.invoiceCount}</TableCell>
                  <TableCell align="right">{r.daysToExpiry < 0 ? `${Math.abs(r.daysToExpiry)}d ago` : `${r.daysToExpiry}d`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </ReportBody>
    </Stack>
  );
}

const VENDOR_REPORTS = [
  { label: 'My invoices', icon: <ReceiptLong fontSize="small" />, render: () => <VendorInvoicesReport /> },
  { label: 'My payments', icon: <AccountBalanceWallet fontSize="small" />, render: () => <VendorPaymentsReport /> },
  { label: 'My contracts', icon: <EventBusy fontSize="small" />, render: () => <VendorContractsReport /> },
];

// ---- Vendor-focused reports (for officers) ---------------------------------

function VendorSummaryReport() {
  const { data, isLoading } = useQuery({ queryKey: ['report', 'vendor-summary'], queryFn: reportsApi.vendorSummary });
  const rows = data ?? [];
  return (
    <ReportBody isLoading={isLoading} isEmpty={rows.length === 0} emptyText="No vendors yet.">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Vendor</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="right">Rating</TableCell>
              <TableCell align="right">Contracts</TableCell>
              <TableCell align="right">POs/WOs</TableCell>
              <TableCell align="right">Invoices</TableCell>
              <TableCell align="right">Billed</TableCell>
              <TableCell align="right">Paid</TableCell>
              <TableCell align="right">Outstanding</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>
                  <Stack>
                    <Typography variant="body2" fontWeight={600}>{r.legalName}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.vendorCode}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{r.categoryName ?? '—'}</TableCell>
                <TableCell align="right">{r.rating != null ? r.rating.toFixed(1) : '—'}</TableCell>
                <TableCell align="right">{fmtNumber(r.contracts)}</TableCell>
                <TableCell align="right">{fmtNumber(r.workOrders)}</TableCell>
                <TableCell align="right">{fmtNumber(r.invoices)}</TableCell>
                <TableCell align="right">{compactCurrency(r.totalBilled)}</TableCell>
                <TableCell align="right">{compactCurrency(r.totalPaid)}</TableCell>
                <TableCell align="right">{compactCurrency(r.outstanding)}</TableCell>
                <TableCell><Chip size="small" variant="outlined" label={r.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </ReportBody>
  );
}

function TopVendorsReport() {
  const { data, isLoading } = useQuery({ queryKey: ['report', 'top-vendors'], queryFn: reportsApi.topVendors });
  const rows = data ?? [];
  return (
    <ReportBody isLoading={isLoading} isEmpty={rows.length === 0} emptyText="No disbursements recorded yet.">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell align="right">Paid invoices</TableCell>
              <TableCell align="right">Total paid</TableCell>
              <TableCell>Last settled</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.id} hover>
                <TableCell>{i + 1}</TableCell>
                <TableCell>
                  <Stack>
                    <Typography variant="body2" fontWeight={600}>{r.vendorName}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.vendorCode}</Typography>
                  </Stack>
                </TableCell>
                <TableCell align="right">{fmtNumber(r.paymentCount)}</TableCell>
                <TableCell align="right"><strong>{compactCurrency(r.totalDisbursed)}</strong></TableCell>
                <TableCell>{r.lastPaymentOn ? fmtDate(r.lastPaymentOn) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </ReportBody>
  );
}

// ---- Page ------------------------------------------------------------------

const REPORTS: { key: string; label: string; icon: React.ReactElement; render: () => React.ReactNode; permission?: string }[] = [
  // Moved here from its own menu item (26 Oct 2026); needs the queue permission, not just report.view.
  {
    key: 'payment-queue',
    label: 'Payment queue',
    icon: <Payments fontSize="small" />,
    render: () => <PaymentQueueTable />,
    permission: Permissions.paymentQueueView,
  },
  { key: 'officer-scorecard', label: 'Officer scorecard', icon: <MilitaryTech fontSize="small" />, render: () => <OfficerScorecardReport /> },
  { key: 'workload', label: 'Workload', icon: <Inventory fontSize="small" />, render: () => <OfficerWorkloadReport /> },
  { key: 'responsiveness', label: 'Responsiveness', icon: <Speed fontSize="small" />, render: () => <OfficerResponsivenessReport /> },
  { key: 'approval-performance', label: 'Approval performance', icon: <Groups fontSize="small" />, render: () => <ApprovalPerformanceReport /> },
  { key: 'contract-expiry', label: 'Contract expiry', icon: <EventBusy fontSize="small" />, render: () => <ContractExpiryReport /> },
  {
    key: 'payment-summary',
    label: 'Payment summary',
    icon: <AccountBalanceWallet fontSize="small" />,
    render: () => <PaymentSummaryReportView />,
  },
  { key: 'ageing', label: 'Ageing', icon: <HourglassBottom fontSize="small" />, render: () => <AgeingReportView /> },
  { key: 'tax-deductions', label: 'Tax & deductions', icon: <ReceiptLong fontSize="small" />, render: () => <TaxDeductionReportView /> },
  { key: 'vendor-summary', label: 'Vendor summary', icon: <Store fontSize="small" />, render: () => <VendorSummaryReport /> },
  { key: 'top-vendors', label: 'Top vendors', icon: <EmojiEvents fontSize="small" />, render: () => <TopVendorsReport /> },
];

export function ReportsPage() {
  const { isVendor, can } = useAuth();
  // `?tab=<key>` opens a tab directly (e.g. /reports?tab=payment-queue from the old Payment Queue links).
  const [searchParams, setSearchParams] = useSearchParams();
  // Vendors get a self-service report set scoped to their own records; officers get the
  // operational and financial reports across the organisation.
  const reports = isVendor ? VENDOR_REPORTS : REPORTS.filter((r) => !r.permission || can(r.permission));
  const requested = reports.findIndex((r) => 'key' in r && r.key === searchParams.get('tab'));
  const [chosen, setTab] = useState(0);
  const tab = Math.min(requested >= 0 ? requested : chosen, reports.length - 1);
  const active = reports[tab];
  return (
    <>
      <PageHeader
        title={isVendor ? 'My Reports' : 'Reports'}
        subtitle={
          isVendor
            ? 'Your invoices, payments and contracts at a glance'
            : 'Operational and financial reports across approvals, contracts and payments'
        }
        icon={<Assessment />}
      />
      <Card variant="outlined">
        <Tabs
          value={tab}
          onChange={(_, v) => {
            setTab(v);
            if (searchParams.has('tab')) setSearchParams({}, { replace: true });
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
        >
          {reports.map((r) => (
            <Tab key={r.label} label={r.label} icon={r.icon} iconPosition="start" sx={{ minHeight: 56 }} />
          ))}
        </Tabs>
        <CardContent>{active.render()}</CardContent>
      </Card>
    </>
  );
}
