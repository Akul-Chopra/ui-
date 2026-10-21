import { useQuery } from '@tanstack/react-query';
import { Box, Typography, CircularProgress, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import { auditApi } from '@/api/endpoints';
import { dateTime } from '@/lib/format';

const TONE_COLOR: Record<string, string> = {
  success: '#16a34a',
  info: '#2563eb',
  warning: '#d97706',
  danger: '#dc2626',
  neutral: '#94a3b8',
};

/**
 * The per-document timeline. Renders the backend's merged audit + approval history as a
 * vertical rail, which is the concept note's "complete audit timeline for every document"
 * made visual — one can read a document's life from submission to settlement.
 */
export function DocumentTimeline({ entityName, entityId }: { entityName: string; entityId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['timeline', entityName, entityId],
    queryFn: () => auditApi.timeline(entityName, entityId),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No history recorded yet.
      </Typography>
    );
  }

  return (
    <Box sx={{ pl: 1 }}>
      {data.events.map((e, i) => {
        const color = TONE_COLOR[e.tone] ?? TONE_COLOR.neutral;
        const isLast = i === data.events.length - 1;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.05, 0.5) }}
          >
            <Stack direction="row" spacing={1.5}>
              {/* The rail: a dot and a connecting line. */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color, mt: 0.5 }} />
                {!isLast && <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', my: 0.5 }} />}
              </Box>
              <Box sx={{ pb: isLast ? 0 : 2.5, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600}>
                  {e.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {e.userName ?? 'system'} · {dateTime(e.timestamp)} ·{' '}
                  <Box component="span" sx={{ color }}>
                    {e.source}
                  </Box>
                </Typography>
                {e.remarks && (
                  <Typography variant="caption" sx={{ fontStyle: 'italic' }} color="text.secondary">
                    “{e.remarks}”
                  </Typography>
                )}
              </Box>
            </Stack>
          </motion.div>
        );
      })}
    </Box>
  );
}
