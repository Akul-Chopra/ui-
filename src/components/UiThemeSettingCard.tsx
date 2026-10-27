import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CircularProgress, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Palette } from '@mui/icons-material';
import { uiThemeApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { UiThemeMode } from '@/api/types';
import { useAuth } from '@/lib/useAuth';
import { Permissions, RoleCodes } from '@/lib/permissions';
import { UI_THEME_QUERY_KEY } from '@/lib/useUiThemeSync';
import { useAppDispatch, useAppSelector } from '@/store';
import { showToast } from '@/store/uiSlice';

/**
 * Super Admin only: switches the application look for every user between the VPS theme and
 * the NGPS-inspired theme. Hidden from everyone else; the API refuses them as well.
 */
export function UiThemeSettingCard() {
  const { can, isInRole } = useAuth();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const mode = useAppSelector((s) => s.ui.uiTheme.mode);

  const update = useMutation({
    mutationFn: (next: UiThemeMode) => uiThemeApi.update(next),
    onSuccess: async (_, next) => {
      // Refetch so this session applies (and caches) it now; others pick it up on next load.
      await queryClient.invalidateQueries({ queryKey: UI_THEME_QUERY_KEY });
      dispatch(
        showToast({
          message: next === 'NGPS' ? 'NGPS theme applied for all users.' : 'VPS theme applied for all users.',
          severity: 'success',
        })
      );
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  if (!isInRole(RoleCodes.SuperAdmin) || !can(Permissions.themeManage)) return null;

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ py: 1.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          {/* Same 140px label column as the Organisation card above, so the controls line up. */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: { sm: 140 }, flexShrink: 0 }}>
            <Palette fontSize="small" color="action" />
            <Typography variant="subtitle2">Appearance</Typography>
          </Stack>
          <ToggleButtonGroup
            exclusive
            size="small"
            sx={{ flexShrink: 0, '& .MuiToggleButton-root': { height: 40, px: 2 } }}
            color="primary"
            value={mode}
            disabled={update.isPending}
            onChange={(_, next: UiThemeMode | null) => next && next !== mode && update.mutate(next)}
            aria-label="Application theme"
          >
            <ToggleButton value="VPS">VPS theme</ToggleButton>
            <ToggleButton value="NGPS">NGPS theme</ToggleButton>
          </ToggleButtonGroup>
          {update.isPending && <CircularProgress size={18} />}
          <Typography variant="caption" color="text.secondary">
            Applies to every user and every organisation. Forms, data and permissions are unchanged.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
