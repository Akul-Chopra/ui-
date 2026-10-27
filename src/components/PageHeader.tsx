import { Box, Typography, Stack } from '@mui/material';
import { motion } from 'framer-motion';

/** Consistent page title block, with an optional actions area on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* The class is a styling hook for the NGPS look (ngpsTheme.ts); the VPS look has no rule for it. */}
      <Stack
        className="vps-page-header"
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={2}
        sx={{ mb: 3 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          {icon && (
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              {icon}
            </Box>
          )}
          <Box>
            <Typography variant="h5">{title}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
      </Stack>
    </motion.div>
  );
}
