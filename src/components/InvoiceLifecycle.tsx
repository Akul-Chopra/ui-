import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Chip, Skeleton, Stack, Typography } from '@mui/material';
import { Cancel, CheckCircle, RadioButtonChecked, RadioButtonUnchecked } from '@mui/icons-material';
import { auditApi, invoicesApi, workflowsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { InvoiceLifecycle as Lifecycle, TimelineEvent } from '@/api/types';
import { sanctionOrderStatus } from '@/components/NgpsStatusChip';
import { WorkflowProgress } from '@/components/WorkflowProgress';
import { DocumentTimeline, StageEvents } from '@/components/Timeline';
import { currency, date, dateTime } from '@/lib/format';

type StageState = 'done' | 'current' | 'failed' | 'pending';

interface Stage {
  key: string;
  title: string;
  state: StageState;
  label: string;
  details: (string | null | undefined)[];
  when?: string | null;
}

// Same markers and chip colours as the approval levels above them (WorkflowProgress), so the
// rail reads as one timeline.
const VISUAL: Record<StageState, { icon: React.ReactNode; tint: string; chip: 'success' | 'info' | 'error' | 'default' }> = {
  done: { icon: <CheckCircle fontSize="small" />, tint: 'success.main', chip: 'success' },
  current: { icon: <RadioButtonChecked fontSize="small" />, tint: 'info.main', chip: 'info' },
  failed: { icon: <Cancel fontSize="small" />, tint: 'error.main', chip: 'error' },
  pending: { icon: <RadioButtonUnchecked fontSize="small" />, tint: 'text.disabled', chip: 'default' },
};

/** The NGPS progress codes (document §3.5) that mean the Payment Order exists / is signed / is at the bank. */
const PO_CREATED = 30;
const PO_SIGNED_MAKER = 40;
const PO_SIGNED_CHECKER = 50;
const SENT_TO_BANK = 60;
const REJECTED_BY_BANK = 70;
const ACCEPTED_BY_BANK = 80;
const PAID = 120;
const FAILED = 110;

/** The stages after approval, in order (approval itself is the rail's own levels). */
function buildStages(l: Lifecycle): Stage[] {
  const code = l.sanctionOrderResponseCode ?? 0;
  const bank = l.bankResultCode ?? null;
  const settled = ['FinanceApproved', 'PendingPayment', 'PartiallyPaid', 'Paid'].includes(l.status) || !!l.financeReviewedOn;
  const orderLive = l.sanctionOrderState === 'Accepted' || l.sanctionOrderState === 'Completed';

  const sanction: Stage = !l.sanctionOrderNo
    ? { key: 'sanction', title: 'Sanction Order', state: 'pending', label: 'Not sent', details: [] }
    : {
        key: 'sanction',
        title: 'Sanction Order',
        state: l.sanctionOrderState === 'Rejected' || l.sanctionOrderState === 'Cancelled' ? 'failed' : l.sanctionOrderState === 'Pending' ? 'current' : 'done',
        label: sanctionOrderStatus({ state: l.sanctionOrderState ?? 'Pending', code: l.sanctionOrderResponseCode, text: l.sanctionOrderStatusText }).label,
        details: [`Sanction Order ${l.sanctionOrderNo}`, l.ngpsReferenceNo ? `NGPS ref ${l.ngpsReferenceNo}` : null],
        when: l.sanctionOrderSentOn,
      };

  const paymentOrder: Stage =
    orderLive && (l.paymentOrderId || code >= PO_CREATED)
      ? {
          key: 'payment-order',
          title: 'Payment Order',
          state: code >= PO_SIGNED_CHECKER ? 'done' : 'current',
          label: code >= PO_SIGNED_CHECKER ? 'Signed' : code >= PO_SIGNED_MAKER ? 'Signed by Maker' : 'Created',
          details: [
            l.paymentOrderId ? `PO ${l.paymentOrderId}` : null,
            l.paymentOrderSignedBy ? `Signed by ${l.paymentOrderSignedBy}` : null,
          ],
          when: l.paymentOrderSignedOn,
        }
      : { key: 'payment-order', title: 'Payment Order', state: 'pending', label: 'Not created', details: [] };

  // Dates are passed raw: `when()` formats a VPS timestamp and shows NGPS's own date text as is,
  // so a missing value can fall back to the other one.
  const disbursement: Stage =
    bank === PAID || code === ACCEPTED_BY_BANK || l.paymentStatus === 'Disbursed'
      ? { key: 'disbursement', title: 'Disbursement', state: 'done', label: 'Processed by bank', details: [l.bankName], when: l.bankProcessDate ?? l.disbursedOn }
      : bank === FAILED
        ? { key: 'disbursement', title: 'Disbursement', state: 'failed', label: 'Failed at bank', details: [l.bankName, l.bankFailureReason], when: l.bankProcessDate }
      : code === REJECTED_BY_BANK
        ? { key: 'disbursement', title: 'Disbursement', state: 'failed', label: 'Rejected by bank', details: [l.bankFailureReason] }
        : orderLive && code >= SENT_TO_BANK
          ? { key: 'disbursement', title: 'Disbursement', state: 'current', label: 'Sent to bank', details: [l.bankName] }
          : { key: 'disbursement', title: 'Disbursement', state: 'pending', label: 'Not sent to bank', details: [] };

  const paid = bank === PAID || l.status === 'Paid';
  const payment: Stage = paid
    ? { key: 'payment', title: 'Payment status', state: 'done', label: 'Paid', details: [`${currency(l.paidAmount || l.netPayableAmount)} of ${currency(l.netPayableAmount)}`, l.paymentNumber], when: l.disbursedOn ?? l.bankProcessDate }
    : bank === FAILED || l.paymentStatus === 'Failed'
      ? { key: 'payment', title: 'Payment status', state: 'failed', label: 'Payment failed', details: [l.bankFailureReason ?? l.paymentFailureReason, l.paymentNumber] }
      : l.status === 'PartiallyPaid'
        ? { key: 'payment', title: 'Payment status', state: 'current', label: 'Partially paid', details: [`${currency(l.paidAmount)} of ${currency(l.netPayableAmount)}`] }
        : { key: 'payment', title: 'Payment status', state: l.paymentNumber ? 'current' : 'pending', label: l.paymentNumber ? 'Awaiting payment' : 'Not paid', details: [l.paymentNumber, l.adviceNumber ? `Advice ${l.adviceNumber}` : null] };

  return [
    {
      key: 'settlement',
      title: 'Finance settlement',
      state: settled ? 'done' : l.status === 'Rejected' || l.status === 'Cancelled' ? 'failed' : 'pending',
      label: settled ? 'Settled' : 'Not settled',
      details: settled ? [`Net payable ${currency(l.netPayableAmount)}`] : [],
      when: l.financeReviewedOn,
    },
    sanction,
    paymentOrder,
    disbursement,
    payment,
    {
      key: 'utr',
      title: 'UTR',
      state: l.utr ? 'done' : 'pending',
      label: l.utr ? 'Received' : 'Not yet',
      details: [l.utr],
    },
  ];
}

/** A slot on the rail that history events can be filed under, with when it was completed. */
interface Slot {
  key: string;
  doneAt?: number;
  isCurrent: boolean;
}

function toTime(value?: string | null): number | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : t;
}

/**
 * Files each history event under a rail slot: the first slot completed at or after the event
 * (a second of slack for rows written in the same transaction), otherwise the slot in progress,
 * otherwise the last slot.
 */
function groupEvents(events: TimelineEvent[], slots: Slot[]): Record<string, TimelineEvent[]> {
  const groups: Record<string, TimelineEvent[]> = {};
  const fallback = slots.find((s) => s.isCurrent) ?? slots[slots.length - 1];
  for (const e of [...events].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))) {
    const t = Date.parse(e.timestamp);
    const slot = slots.find((s) => s.doneAt !== undefined && t <= s.doneAt + 1000) ?? fallback;
    if (slot) (groups[slot.key] ??= []).push(e);
  }
  return groups;
}

/**
 * The invoice's single timeline for the Activity tab: the approval levels, then settlement →
 * Sanction Order → Payment Order → disbursement → payment → UTR on the same rail, with each
 * recorded history event shown under the stage it belongs to. "Show full history" opens the raw
 * audit list. The three requests share their caches with the components that draw them.
 */
export function InvoiceActivityTimeline({ invoiceId }: { invoiceId: string }) {
  const [showAll, setShowAll] = useState(false);
  const progress = useQuery({
    queryKey: ['wf-progress', 'Invoice', invoiceId],
    queryFn: () => workflowsApi.progress('Invoice', invoiceId),
  });
  const timeline = useQuery({
    queryKey: ['timeline', 'Invoice', invoiceId],
    queryFn: () => auditApi.timeline('Invoice', invoiceId),
  });
  const lifecycle = useQuery({
    queryKey: ['invoice', invoiceId, 'lifecycle'],
    queryFn: () => invoicesApi.lifecycle(invoiceId),
    staleTime: 30 * 1000,
  });

  const { stepExtras, stageExtras } = useMemo(() => {
    const steps = progress.data?.hasWorkflow ? progress.data.steps : [];
    const stages = lifecycle.data ? buildStages(lifecycle.data) : [];
    const slots: Slot[] = [
      ...steps.map((s) => ({ key: `level-${s.stepNumber}`, doneAt: toTime(s.actionedOn), isCurrent: s.isCurrent })),
      ...stages.map((s) => ({
        key: s.key,
        doneAt: s.state === 'done' || s.state === 'failed' ? toTime(s.when) : undefined,
        isCurrent: false,
      })),
    ];
    // After approval, the first stage not yet done is the one in progress.
    if (!slots.some((s) => s.isCurrent)) {
      const next = stages.find((s) => s.state === 'current' || s.state === 'pending');
      const slot = next && slots.find((s) => s.key === next.key);
      if (slot) slot.isCurrent = true;
    }
    const groups = groupEvents(timeline.data?.events ?? [], slots);

    const stepExtras: Record<number, React.ReactNode> = {};
    for (const s of steps) {
      // A level's own row already shows its approval decision; list only the other events.
      const events = (groups[`level-${s.stepNumber}`] ?? []).filter((e) => e.source !== 'Approval');
      if (events.length) stepExtras[s.stepNumber] = <StageEvents events={events} />;
    }
    const stageExtras: Record<string, React.ReactNode> = {};
    for (const s of stages) {
      const events = groups[s.key] ?? [];
      if (events.length) stageExtras[s.key] = <StageEvents events={events} />;
    }
    return { stepExtras, stageExtras };
  }, [progress.data, lifecycle.data, timeline.data]);

  const total = timeline.data?.events.length ?? 0;
  return (
    <Box>
      <WorkflowProgress
        entityType="Invoice"
        entityId={invoiceId}
        stepExtras={stepExtras}
        continuation={<InvoiceLifecycleStages invoiceId={invoiceId} stageExtras={stageExtras} />}
      />
      {total > 0 && (
        <Box sx={{ mt: 2 }}>
          <Button size="small" onClick={() => setShowAll((v) => !v)} sx={{ px: 0 }}>
            {showAll ? 'Hide full history' : `Show full history (${total})`}
          </Button>
          {showAll && (
            <Box sx={{ mt: 1.5 }}>
              <DocumentTimeline entityName="Invoice" entityId={invoiceId} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

/** Dates arrive either as ISO timestamps (VPS) or as NGPS's own text; show both sensibly. */
function when(value?: string | null): string {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  // A date stored without a time (midnight UTC, e.g. a manual payment's disbursal date) shows as a date.
  return /T00:00:00(\.0+)?(Z|\+00:00)$/.test(value) ? date(value) : dateTime(value);
}

/** One stage on the rail, drawn like an approval level: marker + connector, title + chip, details. */
function StageRow({ stage, isLast, extra }: { stage: Stage; isLast: boolean; extra?: React.ReactNode }) {
  const v = VISUAL[stage.state];
  const details = stage.details.filter((d): d is string => !!d);
  const at = when(stage.when);
  return (
    <Stack direction="row" spacing={1.5} alignItems="stretch">
      <Stack alignItems="center" sx={{ width: 24 }}>
        <Box sx={{ color: v.tint, display: 'grid', placeItems: 'center', mt: 0.25 }}>{v.icon}</Box>
        {!isLast && <Box sx={{ flex: 1, width: 2, bgcolor: 'divider', my: 0.25 }} />}
      </Stack>
      <Box sx={{ pb: isLast ? 0 : 2, flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle2" fontWeight={700}>
            {stage.title}
          </Typography>
          <Chip label={stage.label} size="small" color={v.chip} variant="outlined" />
        </Stack>
        {details.length > 0 && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ wordBreak: 'break-word' }}>
            {details.join(' · ')}
          </Typography>
        )}
        {at && (
          <Typography variant="caption" color="text.secondary" display="block">
            {at}
          </Typography>
        )}
        {extra}
      </Box>
    </Stack>
  );
}

/**
 * What happens to an invoice after approval — finance settlement, Sanction Order, Payment Order,
 * disbursement, payment status and UTR — drawn as further stages on the approval rail
 * (pass it as WorkflowProgress's `continuation`). Fetched only while the Activity tab is open,
 * in one request.
 */
export function InvoiceLifecycleStages({
  invoiceId,
  stageExtras,
}: {
  invoiceId: string;
  /** Extra content under a stage, by stage key (e.g. the history events of that stage). */
  stageExtras?: Record<string, React.ReactNode>;
}) {
  const lifecycle = useQuery({
    queryKey: ['invoice', invoiceId, 'lifecycle'],
    queryFn: () => invoicesApi.lifecycle(invoiceId),
    staleTime: 30 * 1000,
  });

  if (lifecycle.isLoading) {
    return (
      <Stack spacing={1} sx={{ pl: 4.5 }}>
        <Skeleton variant="rounded" height={32} />
        <Skeleton variant="rounded" height={32} />
      </Stack>
    );
  }

  if (lifecycle.isError || !lifecycle.data) {
    return (
      <Typography variant="caption" color="error.main" sx={{ pl: 4.5 }}>
        Payment progress could not be loaded: {errorMessage(lifecycle.error)}
      </Typography>
    );
  }

  const stages = buildStages(lifecycle.data);
  return (
    <>
      {stages.map((s, i) => (
        <StageRow key={s.key} stage={s} isLast={i === stages.length - 1} extra={stageExtras?.[s.key]} />
      ))}
      {lifecycle.data.lastCheckedOn && (
        <Typography variant="caption" color="text.secondary" sx={{ pl: 4.5, pt: 1 }}>
          NGPS last checked {dateTime(lifecycle.data.lastCheckedOn)}
        </Typography>
      )}
    </>
  );
}
