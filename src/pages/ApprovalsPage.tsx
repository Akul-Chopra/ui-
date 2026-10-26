import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import {
  FactCheck,
  CheckCircle,
  Cancel,
  Undo,
  Description,
  Assignment,
  ReceiptLong,
  Payments,
  AccessAlarm,
  Timer,
  TimerOutlined,
  HourglassBottom,
  PendingActions,
  ReportProblem,
  PersonOutline,
  OpenInNew,
} from '@mui/icons-material';
import {
  Paper,
  Stack,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
  CircularProgress,
  TextField,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { InputAdornment } from '@mui/material';
import { PageHeader } from '@/components/PageHeader';
import { DelegationPanel } from '@/components/DelegationPanel';
import { DocumentLink } from '@/components/DocumentLink';
import { AdvancedSearchPanel, EMPTY_ADVANCED_FILTERS, type AdvancedFilters } from '@/components/AdvancedSearchPanel';
import { ApprovalActionDialog, type ActionKind } from '@/components/ApprovalActionDialog';
import { approvalsApi, usersApi, type ApprovalSearchParams } from '@/api/endpoints';
import type { ApprovalTask } from '@/api/types';
import { currency, compactCurrency, dateTime } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';

type PaletteKey = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';

const ENTITY_STYLE: Record<string, { color: PaletteKey; icon: React.ReactNode }> = {
  Contract: { color: 'primary', icon: <Description /> },
  WorkOrder: { color: 'secondary', icon: <Assignment /> },
  Invoice: { color: 'info', icon: <ReceiptLong /> },
  Payment: { color: 'success', icon: <Payments /> },
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Invoice and payment tasks carry their own review semantics (deductions, disbursement) and
// are actioned from their dedicated screens; the inbox routes there rather than acting inline.
const ROUTED_ELSEWHERE: Record<string, { label: string; route: string }> = {
  Invoice: { label: 'Review in Invoices', route: '/invoices' },
  Payment: { label: 'Review in Payment Queue', route: '/reports?tab=payment-queue' },
};

// Document-type quick filter. "Other" is everything that is not one of the three headline
// types (today that is Payment, but the predicate stays correct if more types are added).
type TypeKey = 'all' | 'Contract' | 'WorkOrder' | 'Invoice' | 'Other';
const HEADLINE_TYPES = ['Contract', 'WorkOrder', 'Invoice'];
const TYPE_FILTERS: { key: TypeKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Contract', label: 'Contract' },
  { key: 'WorkOrder', label: 'Purchase Order / Work Order' },
  { key: 'Invoice', label: 'Invoice' },
  { key: 'Other', label: 'Other' },
];

function matchesType(entityType: string, key: TypeKey): boolean {
  if (key === 'all') return true;
  if (key === 'Other') return !HEADLINE_TYPES.includes(entityType);
  return entityType === key;
}

// Age / status quick filter. The "pending ≥ N" options measure how long a task has waited
// (from when it was assigned); "overdue" is past its SLA due date; "custom" shows tasks
// pending since on or before a chosen date.
type AgeKey = 'all' | 'overdue' | '1m' | '2m' | '6m' | '1y' | 'custom';
const AGE_FILTERS: { key: AgeKey; label: string }[] = [
  { key: 'all', label: 'Any age' },
  { key: 'overdue', label: 'Overdue' },
  { key: '1m', label: 'Pending ≥ 1 month' },
  { key: '2m', label: 'Pending ≥ 2 months' },
  { key: '6m', label: 'Pending ≥ 6 months' },
  { key: '1y', label: 'Pending ≥ 1 year' },
  { key: 'custom', label: 'Pending on/before…' },
];
const AGE_DAYS: Partial<Record<AgeKey, number>> = { '1m': 30, '2m': 60, '6m': 182, '1y': 365 };

/** Translates the free-text term + advanced-search state into the server's own param names. */
function toApprovalSearchParams(searchTerm: string, f: AdvancedFilters): ApprovalSearchParams {
  return {
    searchTerm: searchTerm || undefined,
    vendorId: f.vendorId,
    minAmount: f.minAmount,
    maxAmount: f.maxAmount,
    assignedFrom: f.dateFrom,
    assignedTo: f.dateTo,
  };
}

export function ApprovalsPage() {
  const { isInRole, isPlatformAdmin } = useAuth();
  const isAdmin = isPlatformAdmin || isInRole('TENANT_ADMIN');

  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [pendingWith, setPendingWith] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<TypeKey>('all');
  const [ageFilter, setAgeFilter] = useState<AgeKey>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);
  const [action, setAction] = useState<{ task: ApprovalTask; kind: ActionKind } | null>(null);

  const filtersActive =
    typeFilter !== 'all' || ageFilter !== 'all' || !!searchTerm || Object.keys(advanced).length > 0;
  const clearFilters = () => {
    setTypeFilter('all');
    setAgeFilter('all');
    setCustomDate('');
    setSearchTerm('');
    setAdvanced(EMPTY_ADVANCED_FILTERS);
  };

  const searchParams = toApprovalSearchParams(searchTerm, advanced);

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', scope, scope === 'all' ? pendingWith : '', searchParams],
    queryFn: () =>
      scope === 'all' ? approvalsApi.all(pendingWith || undefined, searchParams) : approvalsApi.mine(searchParams),
  });

  // The "pending with" filter lists only officers who actually hold an open task (no vendors);
  // only shown in the org-wide view.
  const users = useQuery({
    queryKey: ['pending-approvers', 'all'],
    queryFn: () => usersApi.pendingApprovers(),
    enabled: scope === 'all',
  });

  // Filter (type + age), then order: overdue first, then soonest due, then the rest — the
  // queue reads top-down by urgency. Type counts drive the per-type toggles; the summary
  // stats reflect the filtered view so the KPI strip matches what is on screen.
  const { ordered, stats, typeCounts } = useMemo(() => {
    const now = Date.now();
    const customCutoff = customDate ? new Date(`${customDate}T23:59:59`).getTime() : null;
    const matchesAge = (t: ApprovalTask) => {
      if (ageFilter === 'all') return true;
      if (ageFilter === 'overdue') return t.isOverdue;
      if (ageFilter === 'custom')
        return customCutoff == null || new Date(t.assignedOn).getTime() <= customCutoff;
      const days = AGE_DAYS[ageFilter];
      return days == null || now - new Date(t.assignedOn).getTime() >= days * DAY_MS;
    };

    // Age filter applies to the type counts too, so the numbers on the toggles agree with
    // what selecting each type would show.
    const ageFiltered = (data ?? []).filter(matchesAge);
    const counts: Record<TypeKey, number> = { all: 0, Contract: 0, WorkOrder: 0, Invoice: 0, Other: 0 };
    for (const t of ageFiltered) {
      counts.all++;
      const bucket: TypeKey = HEADLINE_TYPES.includes(t.entityType) ? (t.entityType as TypeKey) : 'Other';
      counts[bucket]++;
    }

    const filtered = ageFiltered.filter((t) => matchesType(t.entityType, typeFilter));
    let overdue = 0;
    let soon = 0;
    let value = 0;
    for (const t of filtered) {
      if (t.isOverdue) overdue++;
      else if (t.dueOn && new Date(t.dueOn).getTime() - now < DAY_MS) soon++;
      if (t.amount) value += t.amount;
    }
    const rank = (t: ApprovalTask) => (t.isOverdue ? 0 : t.dueOn ? 1 : 2);
    const sorted = [...filtered].sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      const da = a.dueOn ? new Date(a.dueOn).getTime() : Infinity;
      const db = b.dueOn ? new Date(b.dueOn).getTime() : Infinity;
      return da - db;
    });
    return { ordered: sorted, stats: { total: filtered.length, overdue, soon, value }, typeCounts: counts };
  }, [data, typeFilter, ageFilter, customDate]);

  const hasAny = !isLoading && !!data && data.length > 0;
  const hasVisible = ordered.length > 0;

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="Documents awaiting your decision, across every approval level"
        icon={<FactCheck />}
      />

      {/* Controls: scope, then the type and age quick-filters. */}
      <Stack spacing={1.25} sx={{ mb: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ sm: 'center' }}
          flexWrap="wrap"
          useFlexGap
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={scope}
            onChange={(_, v) => v && setScope(v)}
            color="primary"
          >
            <ToggleButton value="mine">My queue</ToggleButton>
            <ToggleButton value="all">All pending</ToggleButton>
          </ToggleButtonGroup>

          {scope === 'all' && (
            <TextField
              select
              size="small"
              label="Pending with"
              value={pendingWith}
              onChange={(e) => setPendingWith(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">
                <em>Anyone</em>
              </MenuItem>
              {(users.data ?? []).map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.fullName}
                </MenuItem>
              ))}
            </TextField>
          )}

          {scope === 'all' && (
            <Typography variant="caption" color="text.secondary">
              Transparency view — you can act only on tasks assigned to you{isAdmin ? ' (admins can act on any)' : ''}.
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder="Search by title, reference, vendor…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <AdvancedSearchPanel filters={advanced} onChange={setAdvanced} amountLabel="Value" />
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          {/* Type quick-filter — each button doubles as a per-type count. */}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={typeFilter}
            onChange={(_, v) => v && setTypeFilter(v as TypeKey)}
          >
            {TYPE_FILTERS.map((tf) => (
              <ToggleButton key={tf.key} value={tf.key} sx={{ textTransform: 'none', px: 1.25, gap: 0.75 }}>
                {tf.label}
                <Chip
                  label={typeCounts[tf.key]}
                  size="small"
                  color={typeFilter === tf.key ? 'primary' : 'default'}
                  sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }}
                />
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <TextField
            select
            size="small"
            label="Age / status"
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value as AgeKey)}
            sx={{ minWidth: 190 }}
          >
            {AGE_FILTERS.map((a) => (
              <MenuItem key={a.key} value={a.key}>
                {a.label}
              </MenuItem>
            ))}
          </TextField>

          {ageFilter === 'custom' && (
            <TextField
              type="date"
              size="small"
              label="Pending on/before"
              InputLabelProps={{ shrink: true }}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          )}

          {filtersActive && (
            <Button size="small" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Compact KPI strip — a single slim row so it stays out of the way. */}
      {hasAny && (
        <Paper
          variant="outlined"
          sx={{
            px: 2,
            py: 1,
            mb: 2,
            borderRadius: 2,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: { xs: 2, sm: 3.5 },
            rowGap: 1,
          }}
        >
          <KpiItem icon={<PendingActions fontSize="small" />} color="primary" value={String(stats.total)} label={scope === 'all' ? 'Pending' : 'Awaiting you'} />
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
          <KpiItem icon={<ReportProblem fontSize="small" />} color="error" value={String(stats.overdue)} label="Overdue" muted={stats.overdue === 0} />
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
          <KpiItem icon={<HourglassBottom fontSize="small" />} color="warning" value={String(stats.soon)} label="Due within 24h" muted={stats.soon === 0} />
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
          <KpiItem icon={<Payments fontSize="small" />} color="success" value={compactCurrency(stats.value)} label="Value in queue" />
        </Paper>
      )}

      <Box sx={{ mb: 2 }}>
        <DelegationPanel />
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : hasAny && !hasVisible ? (
        <Paper
          variant="outlined"
          sx={{ p: 6, textAlign: 'center', borderRadius: 4, borderStyle: 'dashed' }}
        >
          <Avatar
            sx={{
              width: 64,
              height: 64,
              mx: 'auto',
              mb: 2,
              bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
              color: 'text.secondary',
            }}
          >
            <FactCheck sx={{ fontSize: 34 }} />
          </Avatar>
          <Typography variant="h6" fontWeight={800}>
            No approvals match these filters
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Try a different type or age, or clear the filters to see everything.
          </Typography>
          {filtersActive && (
            <Button variant="outlined" size="small" onClick={clearFilters} sx={{ mt: 2 }}>
              Clear filters
            </Button>
          )}
        </Paper>
      ) : !hasVisible ? (
        <Paper
          variant="outlined"
          sx={{ p: 8, textAlign: 'center', borderRadius: 4, borderStyle: 'dashed' }}
        >
          <Avatar
            sx={{
              width: 72,
              height: 72,
              mx: 'auto',
              mb: 2,
              bgcolor: (t) => alpha(t.palette.success.main, 0.12),
              color: 'success.main',
            }}
          >
            <CheckCircle sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h6" fontWeight={800}>
            {scope === 'all' ? 'No pending approvals' : 'You’re all caught up'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {scope === 'all'
              ? pendingWith
                ? 'Nothing is currently pending with this person.'
                : 'Nothing is pending anywhere in the organisation right now.'
              : 'Nothing is waiting for your decision right now. New approval tasks will land here.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {ordered.map((task) => (
            <ApprovalCard
              key={task.taskId}
              task={task}
              isAdmin={isAdmin}
              onAct={(kind) => setAction({ task, kind })}
            />
          ))}
        </Stack>
      )}

      <ApprovalActionDialog action={action} onClose={() => setAction(null)} />
    </>
  );
}

/** One inline metric in the slim KPI strip — icon, value and label on a single line. */
function KpiItem({
  icon,
  color,
  value,
  label,
  muted,
}: {
  icon: React.ReactNode;
  color: PaletteKey;
  value: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', color: muted ? 'text.disabled' : `${color}.main` }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="subtitle1"
          fontWeight={800}
          lineHeight={1}
          color={muted ? 'text.disabled' : 'text.primary'}
        >
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {label}
        </Typography>
      </Box>
    </Stack>
  );
}

/** Segmented approval-chain indicator: filled up to and including the current level. */
function LevelDots({ current, total, color }: { current: number; total: number; color: PaletteKey }) {
  return (
    <Stack direction="row" spacing={0.5}>
      {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
        <Box
          key={i}
          sx={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            bgcolor: i < current ? `${color}.main` : (t) => alpha(t.palette.text.primary, 0.12),
            transition: 'background-color .3s',
          }}
        />
      ))}
    </Stack>
  );
}

function ApprovalCard({
  task,
  isAdmin,
  onAct,
}: {
  task: ApprovalTask;
  isAdmin: boolean;
  onAct: (kind: ActionKind) => void;
}) {
  const navigate = useNavigate();
  const routed = ROUTED_ELSEWHERE[task.entityType];
  const entity = ENTITY_STYLE[task.entityType] ?? { color: 'primary' as PaletteKey, icon: <Description /> };
  const totalSteps = task.totalSteps || task.stepNumber;
  // Ownership is the default gate for acting; an admin may act on any task to unblock it.
  const canAct = task.isMine || isAdmin;

  const dueMs = task.dueOn ? new Date(task.dueOn).getTime() - Date.now() : null;
  const accent: PaletteKey = task.isOverdue
    ? 'error'
    : dueMs != null && dueMs < DAY_MS
      ? 'warning'
      : 'primary';

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        borderRadius: 3,
        overflow: 'hidden',
        border: (t) => `1px solid ${t.palette.divider}`,
        transition: 'box-shadow .2s ease, transform .2s ease',
        '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
      }}
    >
      {/* Urgency accent rail down the left edge. */}
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, bgcolor: `${accent}.main` }} />

      <Box sx={{ p: 2.5, pl: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} justifyContent="space-between">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Avatar
                variant="rounded"
                sx={{
                  bgcolor: (t) => alpha(t.palette[entity.color].main, 0.14),
                  color: `${entity.color}.main`,
                  width: 46,
                  height: 46,
                  flexShrink: 0,
                }}
              >
                {entity.icon}
              </Avatar>

              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle1" fontWeight={800}>
                    {task.title ?? task.entityReference ?? 'Document'}
                  </Typography>
                  {task.isEscalated && <Chip label="Escalated" size="small" color="warning" variant="outlined" />}
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
                  <Chip label={task.entityType} size="small" variant="outlined" color={entity.color} />
                  <Typography variant="caption" color="text.secondary" component="span">
                    <DocumentLink
                      type={task.entityType}
                      entityId={task.entityId}
                      reference={task.entityReference}
                      bold={false}
                    />
                  </Typography>
                  {task.amount != null && (
                    <Typography variant="caption" fontWeight={800} color="text.primary">
                      {currency(task.amount)}
                    </Typography>
                  )}
                </Stack>

                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {task.initiatedBy && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <PersonOutline sx={{ fontSize: 15 }} color="action" />
                      <Typography variant="caption" color="text.secondary">
                        Raised by {task.initiatedBy}
                      </Typography>
                    </Stack>
                  )}
                  {!task.isMine && task.assignedTo && (
                    <Chip
                      icon={<PendingActions sx={{ fontSize: 15 }} />}
                      label={`Pending with ${task.assignedTo}`}
                      size="small"
                      color={accent === 'error' ? 'error' : 'default'}
                      variant="outlined"
                    />
                  )}
                </Stack>
                {task.isMine && (
                  <Chip label="Assigned to you" size="small" color="primary" variant="outlined" sx={{ mt: 0.5 }} />
                )}
              </Box>

              {/* Live "watch" timer for the SLA / overdue clock, top-right of the card. */}
              <Box sx={{ ml: 'auto', alignSelf: 'flex-start', flexShrink: 0 }}>
                <SlaTimerBadge assignedOn={task.assignedOn} dueOn={task.dueOn} />
              </Box>
            </Stack>

            {/* Where this task sits in the approval chain. */}
            <Box sx={{ mt: 1.75, maxWidth: 380 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" fontWeight={700}>
                  {task.stepName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Level {task.stepNumber} of {totalSteps}
                </Typography>
              </Stack>
              <LevelDots current={task.stepNumber} total={totalSteps} color={accent} />
            </Box>

            <SlaCountdownBar assignedOn={task.assignedOn} dueOn={task.dueOn} />
          </Box>

          {/* Actions: inline for contracts/work orders; a link for invoice/payment tasks. */}
          <Stack
            direction={{ xs: 'row', md: 'column' }}
            spacing={1}
            justifyContent="center"
            sx={{ minWidth: { md: 156 }, flexShrink: 0 }}
          >
            {routed ? (
              <Button variant="outlined" endIcon={<OpenInNew />} onClick={() => navigate(routed.route)} fullWidth>
                {routed.label}
              </Button>
            ) : canAct ? (
              <>
                <Button
                  color="success"
                  variant="contained"
                  startIcon={<CheckCircle />}
                  onClick={() => onAct('Approve')}
                  fullWidth
                  disableElevation
                >
                  Approve
                </Button>
                {task.canReject && (
                  <Button color="error" variant="outlined" startIcon={<Cancel />} onClick={() => onAct('Reject')} fullWidth>
                    Reject
                  </Button>
                )}
                {task.canReturn && (
                  <Button color="warning" variant="outlined" startIcon={<Undo />} onClick={() => onAct('Return')} fullWidth>
                    Return
                  </Button>
                )}
                {isAdmin && !task.isMine && (
                  <Typography variant="caption" color="text.secondary" textAlign="center">
                    Acting as admin
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ alignSelf: 'center' }}>
                View only
              </Typography>
            )}
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}

/** Re-renders once a second so the countdown ticks live. */
function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m ${s}s`;
}

/**
 * A compact stopwatch-style badge that ticks every second: green while there is comfortable
 * SLA time left, amber inside the last 24h, and a pulsing red "Overdue …" once the due time
 * passes. Digits are tabular so the width does not jitter as it counts.
 */
function SlaTimerBadge({ assignedOn: _assignedOn, dueOn }: { assignedOn: string; dueOn?: string | null }) {
  const now = useNow(1000);

  if (!dueOn) {
    return (
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ px: 1.25, py: 0.5, borderRadius: 999, border: 1, borderColor: 'divider', color: 'text.secondary' }}
      >
        <TimerOutlined sx={{ fontSize: 18 }} />
        <Typography variant="caption" fontWeight={700}>
          No SLA
        </Typography>
      </Stack>
    );
  }

  const remaining = new Date(dueOn).getTime() - now;
  const overdue = remaining <= 0;
  const soon = !overdue && remaining < DAY_MS;
  const tone: PaletteKey = overdue ? 'error' : soon ? 'warning' : 'success';

  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{
        px: 1.5,
        py: 0.6,
        borderRadius: 999,
        border: 2,
        borderColor: `${tone}.main`,
        color: `${tone}.main`,
        bgcolor: (t) => alpha(t.palette[tone].main, 0.1),
        ...(overdue && {
          animation: 'slaPulse 1.4s ease-in-out infinite',
          '@keyframes slaPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
        }),
      }}
    >
      {overdue ? <AccessAlarm sx={{ fontSize: 18 }} /> : <Timer sx={{ fontSize: 18 }} />}
      <Typography
        variant="caption"
        fontWeight={800}
        sx={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 0.3, whiteSpace: 'nowrap' }}
      >
        {overdue ? `Overdue ${formatDuration(-remaining)}` : `${formatDuration(remaining)} left`}
      </Typography>
    </Stack>
  );
}

/**
 * The live SLA timer for a task: an amber bar filling as the window elapses with the time
 * left ticking down, flipping to a solid red "Overdue by …" once the due time passes. The
 * assigned and due instants are printed beneath.
 */
function SlaCountdownBar({ assignedOn, dueOn }: { assignedOn: string; dueOn?: string | null }) {
  const now = useNow(1000);

  // No SLA target on this step — just show when it landed with us.
  if (!dueOn) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: 'block' }}>
        Assigned {dateTime(assignedOn)}
      </Typography>
    );
  }

  const due = new Date(dueOn).getTime();
  const assigned = new Date(assignedOn).getTime();
  const remaining = due - now;
  const overdue = remaining <= 0;
  const windowMs = Math.max(due - assigned, 1);
  const elapsedPct = Math.min(100, Math.max(0, ((now - assigned) / windowMs) * 100));

  return (
    <Box sx={{ mt: 1.25 }}>
      <Box
        sx={{
          position: 'relative',
          height: 28,
          borderRadius: 1,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: overdue ? 'error.main' : (t) => alpha(t.palette.warning.main, 0.25),
        }}
      >
        {!overdue && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${elapsedPct}%`,
              bgcolor: 'warning.main',
              transition: 'width 1s linear',
            }}
          />
        )}
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ position: 'relative', zIndex: 1 }}
        >
          {overdue ? (
            <AccessAlarm sx={{ fontSize: 16, color: '#fff' }} />
          ) : (
            <HourglassBottom sx={{ fontSize: 16, color: '#fff' }} />
          )}
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
          >
            {overdue ? `Overdue by ${formatDuration(-remaining)}` : `${formatDuration(remaining)} left`}
          </Typography>
        </Stack>
      </Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          Assigned {dateTime(assignedOn)}
        </Typography>
        <Typography variant="caption" color={overdue ? 'error.main' : 'text.secondary'}>
          Due {dateTime(dueOn)}
        </Typography>
      </Stack>
    </Box>
  );
}
