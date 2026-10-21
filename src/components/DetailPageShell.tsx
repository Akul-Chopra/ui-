import { Box, Stack, IconButton, Breadcrumbs, Link, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

/**
 * Page chrome for a record's full-page detail view: a back button and a breadcrumb, above a
 * centred, comfortably-wide content column. Replaces the old right-hand slide-over drawers —
 * clicking a record now navigates to its own page rather than opening an overlay.
 */
export function DetailPageShell({
  listLabel,
  listRoute,
  current,
  children,
}: {
  listLabel: string;
  listRoute: string;
  current: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(listRoute)} size="small" aria-label="Back to list">
          <ArrowBack fontSize="small" />
        </IconButton>
        <Breadcrumbs aria-label="breadcrumb">
          <Link
            component="button"
            type="button"
            underline="hover"
            color="inherit"
            onClick={() => navigate(listRoute)}
            sx={{ cursor: 'pointer' }}
          >
            {listLabel}
          </Link>
          <Typography color="text.primary" fontWeight={600}>
            {current}
          </Typography>
        </Breadcrumbs>
      </Stack>
      <Box sx={{ maxWidth: 1040, mx: 'auto' }}>{children}</Box>
    </Box>
  );
}
