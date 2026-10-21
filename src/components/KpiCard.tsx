import { Paper, Box, Typography, Stack } from '@mui/material';
import { motion } from 'framer-motion';

/** A dashboard KPI tile: a value, a label, an icon and an optional sub-line. */
export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = 'primary',
  index = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary';
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // A short stagger by index gives the KPI row a gentle cascade on load rather than
      // popping in all at once.
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      style={{ height: '100%' }}
    >
      <Paper sx={{ p: 2.25, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {label}
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 42,
              height: 42,
              borderRadius: 2,
              bgcolor: `${tone}.main`,
              color: `${tone}.contrastText`,
              opacity: 0.92,
            }}
          >
            {icon}
          </Box>
        </Stack>
        {sub && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', pt: 1 }}>
            {sub}
          </Typography>
        )}
      </Paper>
    </motion.div>
  );
}
