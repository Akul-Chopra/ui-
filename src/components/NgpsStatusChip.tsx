import { StatusChip } from '@/components/StatusChip';

/**
 * Progress of an order once it is held for payment (ResponseCode, NGPS Integration Document
 * §3.5): locked → Payment Order created → signed → with the bank → final. Only 110, 115 and
 * 120 are final.
 */
const PROGRESS_LABELS: Record<number, string> = {
  10: 'Received',
  20: 'Locked',
  25: 'Removal requested',
  30: 'Payment Order created',
  35: 'Re-signing requested',
  40: 'Signed by Maker',
  50: 'Signed by Checker',
  60: 'Sent to bank',
  70: 'Rejected by bank',
  80: 'Accepted by bank',
  110: 'Payment failed',
  115: 'Partially paid',
  120: 'Paid',
};

function progressTone(code: number): string {
  if (code === 120) return 'success';
  if (code === 110 || code === 70) return 'danger';
  if (code === 115 || code === 25 || code === 35) return 'warning';
  return 'info';
}

interface StatusInput {
  state: string;
  code?: number | null;
  text?: string | null;
}

/**
 * One status for a Sanction Order. A refusal or withdrawal says so; while the order is held
 * for payment it shows how far signing and the bank have got; before that it is pending.
 */
export function sanctionOrderStatus({ state, code, text }: StatusInput): { label: string; tone: string } {
  if (state === 'Rejected') return { label: 'Rejected', tone: 'danger' };
  if (state === 'Cancelled') return { label: 'Cancelled', tone: 'neutral' };
  if (state === 'Pending') return { label: 'Pending', tone: 'warning' };
  if (code != null) return { label: PROGRESS_LABELS[code] ?? text ?? 'In progress', tone: progressTone(code) };
  return state === 'Completed' ? { label: 'Completed', tone: 'success' } : { label: 'Accepted', tone: 'info' };
}

export function SanctionOrderStatusChip(props: StatusInput) {
  const { label, tone } = sanctionOrderStatus(props);
  return <StatusChip status={label} tone={tone} />;
}
