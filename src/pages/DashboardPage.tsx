import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Box,
  Typography,
  Stack,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
  Link,
  MenuItem,
  TextField,
  useTheme,
} from '@mui/material';
// MUI 6 keeps the responsive `size` API on Grid2; the legacy Grid still uses item/xs/md.
import Grid from '@mui/material/Grid2';
import {
  Description,
  Assignment,
  ReceiptLong,
  Payments,
  HowToReg,
  CurrencyRupee,
  Store,
  AccountBalanceWallet,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { dashboardApi, usersApi } from '@/api/endpoints';
import { PageHeader } from '@/components/PageHeader';
import { KpiCard } from '@/components/KpiCard';
import { SlaCountdown } from '@/components/SlaCountdown';
import { compactCurrency, currency, relativeTime } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { RoleCodes } from '@/lib/permissions';

// A distinct colour per pie slice, ordered so neighbours never match. Colouring by status
// "tone" repeated blue/orange across many statuses, making adjacent slices blend together;
// indexing this palette by position gives every status its own colour.
const SLICE_PALETTE = [
  '#2563eb', // blue
  '#d97706', // amber
  '#16a34a', // green
  '#dc2626', // red
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#ea580c', // orange
  '#0d9488', // teal
  '#9333ea', // purple
  '#ca8a04', // gold
  '#475569', // slate
];

const sliceColor = (index: number) => SLICE_PALETTE[index % SLICE_PALETTE.length];

export function DashboardPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, isPlatformAdmin, isInRole } = useAuth();
  // Admins may filter the Recent Activity feed to one user; everyone else sees only their own.
  const isAdmin = isPlatformAdmin || isInRole(RoleCodes.TenantAdmin);
  const [activityUser, setActivityUser] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', activityUser],
    queryFn: () => dashboardApi.get(activityUser || undefined),
  });
  const orgUsers = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: isAdmin });

  if (isLoading || !data) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const k = data.kpis;
  const axisColor = theme.palette.text.secondary;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.fullName?.split(' ').slice(-1)[0] ?? ''}`}
        subtitle={`${user?.tenant.name} · Financial Year ${data.financialYear}`}
        icon={<AccountBalanceWallet />}
      />

      {/* KPI row. */}
      <Grid container spacing={2}>
        {[
          { label: 'Pending Contracts', value: k.pendingContracts, icon: <Description />, tone: 'info' as const },
          { label: 'Pending Purchase Orders / Work Orders', value: k.pendingWorkOrders, icon: <Assignment />, tone: 'info' as const },
          { label: 'Pending Invoices', value: k.pendingInvoices, icon: <ReceiptLong />, tone: 'warning' as const },
          { label: 'My Approvals', value: k.pendingApprovals, icon: <HowToReg />, tone: 'error' as const },
          {
            label: "Today's Payments",
            value: compactCurrency(k.todaysPaymentsAmount),
            sub: `${k.todaysPaymentsCount} disbursed`,
            icon: <CurrencyRupee />,
            tone: 'success' as const,
          },
          {
            label: 'FY Disbursed',
            value: compactCurrency(k.financialYearPaymentsAmount),
            icon: <Payments />,
            tone: 'success' as const,
          },
          {
            label: 'In Payment Queue',
            value: compactCurrency(k.amountInPaymentQueue),
            icon: <AccountBalanceWallet />,
            tone: 'warning' as const,
          },
          { label: 'Total Vendors', value: k.totalVendors, icon: <Store />, tone: 'primary' as const },
        ].map((kpi, i) => (
          <Grid key={kpi.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard {...kpi} index={i} />
          </Grid>
        ))}
      </Grid>

      {/* My approval activity — personalised to the signed-in user. */}
      <Paper sx={{ p: 2.5, mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          My Approval Activity
        </Typography>
        <Grid container spacing={2}>
          {[
            { label: 'Approved this week', value: data.myApprovalStats.approvedThisWeek, tone: 'success' as const },
            { label: 'Approved this month', value: data.myApprovalStats.approvedThisMonth, tone: 'success' as const },
            { label: 'Approved (6 months)', value: data.myApprovalStats.approvedLast6Months, tone: 'success' as const },
            { label: 'Pending over a week', value: data.myApprovalStats.pendingOverAWeek, tone: 'warning' as const },
            { label: 'Pending over a month', value: data.myApprovalStats.pendingOverAMonth, tone: 'warning' as const },
            { label: 'Pending over 6 months', value: data.myApprovalStats.pendingOverSixMonths, tone: 'warning' as const },
            { label: 'Overdue', value: data.myApprovalStats.overdue, tone: 'error' as const },
          ].map((s) => (
            <Grid key={s.label} size={{ xs: 6, sm: 4, md: 12 / 7 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  height: '100%',
                }}
              >
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color={s.value > 0 ? `${s.tone}.main` : 'text.primary'}
                >
                  {s.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {s.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Charts. */}
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ p: 2.5, height: 360 }}>
            <Typography variant="h6" gutterBottom>
              Monthly Disbursement · {data.financialYear}
            </Typography>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={data.monthlyPayments} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 12 }} />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 12 }}
                  tickFormatter={(v) => compactCurrency(v as number)}
                  width={70}
                />
                <ReTooltip
                  formatter={(v) => currency(v as number)}
                  contentStyle={{
                    background: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="amount" fill={theme.palette.primary.main} radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ p: 2.5, height: 360 }}>
            <Typography variant="h6" gutterBottom>
              Invoice Status
            </Typography>
            {data.invoiceStatusBreakdown.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="82%">
                <PieChart>
                  <Pie
                    data={data.invoiceStatusBreakdown}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.invoiceStatusBreakdown.map((_s, i) => (
                      <Cell key={i} fill={sliceColor(i)} stroke={theme.palette.background.paper} strokeWidth={2} />
                    ))}
                  </Pie>
                  <ReTooltip
                    contentStyle={{
                      background: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <Stack direction="row" flexWrap="wrap" gap={0.5} justifyContent="center">
              {data.invoiceStatusBreakdown.map((s, i) => (
                <Chip
                  key={s.statusValue}
                  size="small"
                  label={`${s.label}: ${s.count}`}
                  sx={{ bgcolor: sliceColor(i), color: '#fff', fontSize: 11 }}
                />
              ))}
            </Stack>
          </Paper>
        </Grid>

        {/* Pending tasks and recent activity. */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5, minHeight: 300 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography variant="h6" gutterBottom>
                My Pending Approvals
              </Typography>
              <Link
                component="button"
                variant="body2"
                fontWeight={700}
                onClick={() => navigate('/approvals')}
              >
                Open inbox →
              </Link>
            </Stack>
            {data.myPendingTasks.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                Nothing awaiting your action.
              </Typography>
            ) : (
              <List dense>
                {data.myPendingTasks.map((t) => (
                  <ListItemButton
                    key={t.taskId}
                    onClick={() => navigate('/approvals')}
                    disableGutters
                    sx={{ px: 1, borderRadius: 1 }}
                  >
                    <ListItemText
                      primary={`${t.entityType} ${t.entityReference ?? ''}`}
                      secondary={`${t.stepName} · assigned ${relativeTime(t.assignedOn)}`}
                    />
                    <SlaCountdown dueOn={t.dueOn} assignedOn={t.assignedOn} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5, minHeight: 300 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
              <Typography variant="h6">Recent Activity</Typography>
              {isAdmin && (
                <TextField
                  select
                  size="small"
                  label="User"
                  value={activityUser}
                  onChange={(e) => setActivityUser(e.target.value)}
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value="">
                    <em>All users</em>
                  </MenuItem>
                  {[...new Map((orgUsers.data ?? []).map((u) => [u.id, u])).values()].map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.fullName}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>
            {data.recentActivity.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                No activity to show{activityUser ? ' for this user' : ''}.
              </Typography>
            ) : (
              <List dense>
              {data.recentActivity.slice(0, 8).map((a, i) => (
                <Box key={i}>
                  <ListItem disableGutters>
                    <ListItemText
                      primary={`${a.actionLabel} · ${a.entityName} ${a.entityReference ?? ''}`}
                      secondary={`${a.userName ?? 'system'} · ${relativeTime(a.timestamp)}`}
                    />
                  </ListItem>
                  {i < 7 && <Divider component="li" />}
                </Box>
              ))}
            </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </>
  );
}

function EmptyChart() {
  return (
    <Box sx={{ height: '82%', display: 'grid', placeItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        No data yet.
      </Typography>
    </Box>
  );
}
