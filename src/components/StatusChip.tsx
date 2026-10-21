import { Chip } from '@mui/material';
import { toneToChipColor } from '@/theme/theme';

// Maps a raw status enum name (as the list endpoints return it, e.g. "UnderTechnicalReview")
// to a readable label and a tone, so a chip renders consistently without every screen
// repeating the mapping. Where the backend already sends a tone (dashboard breakdowns), use
// <StatusChip label tone> directly instead.
const TONES: Record<string, string> = {
  Active: 'success',
  Approved: 'info',
  Published: 'info',
  InProgress: 'info',
  Completed: 'success',
  Paid: 'success',
  Disbursed: 'success',
  PartiallyPaid: 'info',
  Draft: 'neutral',
  PendingApproval: 'warning',
  PendingVerification: 'warning',
  Submitted: 'info',
  UnderComplianceReview: 'warning',
  UnderTechnicalReview: 'warning',
  UnderFinanceReview: 'warning',
  TechnicalApproved: 'info',
  FinanceApproved: 'info',
  PendingPayment: 'warning',
  OnHold: 'warning',
  Queued: 'warning',
  Processing: 'info',
  Suspended: 'warning',
  Blacklisted: 'danger',
  Rejected: 'danger',
  Cancelled: 'neutral',
  Terminated: 'danger',
  Failed: 'danger',
  Reversed: 'danger',
  Expired: 'neutral',
};

function humanise(status: string): string {
  return status.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

export function StatusChip({
  status,
  tone,
  size = 'small',
}: {
  status: string;
  tone?: string;
  size?: 'small' | 'medium';
}) {
  const resolvedTone = tone ?? TONES[status] ?? 'neutral';
  return (
    <Chip
      label={humanise(status)}
      color={toneToChipColor(resolvedTone)}
      size={size}
      variant={resolvedTone === 'neutral' ? 'outlined' : 'filled'}
    />
  );
}
