import { useEffect, useState } from 'react';
import { Box, Chip, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { HourglassBottom, AlarmOn, CheckCircle } from '@mui/icons-material';
import { dateTime } from '@/lib/format';

/**
 * A live SLA timer for an approval task. While the task is within its window it counts
 * *down* the time left to act (green → amber → red as the deadline nears); once past due it
 * flips to a red "Overdue by …" timer that counts *up*. Optionally renders a timeline bar
 * showing how much of the assigned→due window has elapsed.
 *
 * The deadline (`dueOn`) is set by the workflow / rule engine from the step's SLA, so this
 * reflects exactly the time the reviewer has to approve, reject or return the document.
 */

/** Break a positive millisecond span into a compact, self-updating label. */
function formatSpan(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Show progressively finer units as the deadline approaches, so the last hour visibly ticks.
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

type Tone = 'success' | 'warning' | 'error';

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export function SlaCountdown({
  dueOn,
  assignedOn,
  showTimeline = false,
  size = 'small',
}: {
  /** ISO timestamp the task must be actioned by. When absent, the step carries no SLA. */
  dueOn?: string | null;
  /** ISO timestamp the task was assigned; enables the elapsed timeline. */
  assignedOn?: string | null;
  /** Also render a thin assigned→due progress bar under the timer. */
  showTimeline?: boolean;
  size?: 'small' | 'medium';
}) {
  const now = useNow(!!dueOn);

  if (!dueOn) {
    return (
      <Tooltip title="This approval step has no SLA configured in the workflow">
        <Chip
          icon={<HourglassBottom fontSize="small" />}
          label="No deadline"
          size={size}
          variant="outlined"
          sx={{ color: 'text.secondary' }}
        />
      </Tooltip>
    );
  }

  const due = new Date(dueOn).getTime();
  const remainingMs = due - now;
  const overdue = remainingMs < 0;

  // Colour by urgency: red once overdue or inside the final hour, amber inside the final
  // quarter of the window (or last 8h when there's no assigned time to measure against),
  // green otherwise.
  let tone: Tone = 'success';
  if (overdue || remainingMs < 60 * 60 * 1000) {
    tone = 'error';
  } else if (assignedOn) {
    const windowMs = due - new Date(assignedOn).getTime();
    if (windowMs > 0 && remainingMs / windowMs < 0.25) tone = 'warning';
  } else if (remainingMs < 8 * 60 * 60 * 1000) {
    tone = 'warning';
  }

  const label = overdue ? `Overdue by ${formatSpan(-remainingMs)}` : `${formatSpan(remainingMs)} left`;
  const icon = overdue ? <AlarmOn fontSize="small" /> : tone === 'success' ? <CheckCircle fontSize="small" /> : <HourglassBottom fontSize="small" />;

  // Elapsed fraction of the SLA window for the timeline bar.
  let elapsedPct = overdue ? 100 : 0;
  if (assignedOn && !overdue) {
    const windowMs = due - new Date(assignedOn).getTime();
    if (windowMs > 0) elapsedPct = Math.min(100, Math.max(0, ((now - new Date(assignedOn).getTime()) / windowMs) * 100));
  }

  return (
    <Stack spacing={0.5} sx={{ minWidth: showTimeline ? 200 : undefined }}>
      <Tooltip title={`Due ${dateTime(dueOn)} · per workflow SLA`}>
        <Chip
          icon={icon}
          label={label}
          size={size}
          color={tone}
          variant={overdue || tone !== 'success' ? 'filled' : 'outlined'}
          sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        />
      </Tooltip>
      {showTimeline && (
        <Box>
          <LinearProgress
            variant="determinate"
            value={elapsedPct}
            color={tone}
            sx={{ height: 6, borderRadius: 3 }}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.25 }}>
            <Typography variant="caption" color="text.secondary">
              {assignedOn ? `Assigned ${dateTime(assignedOn)}` : 'Assigned'}
            </Typography>
            <Typography variant="caption" color={overdue ? 'error.main' : 'text.secondary'}>
              Due {dateTime(dueOn)}
            </Typography>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
