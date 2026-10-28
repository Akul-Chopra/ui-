import { Box, Toolbar, useMediaQuery, useTheme } from '@mui/material';
import { useEffect } from 'react';
import { Topbar } from './Topbar';
import { Sidebar, SIDEBAR_WIDTH } from './Sidebar';
import { useAppDispatch, useAppSelector } from '@/store';
import { setSidebar } from '@/store/uiSlice';

/**
 * The authenticated shell: a fixed top bar, a sidebar that is permanent on desktop and a
 * temporary drawer on mobile, and the routed page in the content area.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);

  // On a small screen the sidebar starts closed so the content is not crowded out.
  useEffect(() => {
    dispatch(setSidebar(isDesktop));
  }, [isDesktop, dispatch]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Topbar />
      <Sidebar
        open={sidebarOpen}
        onClose={() => dispatch(setSidebar(false))}
        // Persistent, not permanent: a permanent drawer ignores `open`, so the menu button could
        // not hide the sidebar on desktop.
        variant={isDesktop ? 'persistent' : 'temporary'}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          // Reserve the sidebar's width on desktop so content never sits under it.
          width: { md: isDesktop && sidebarOpen ? `calc(100% - ${SIDEBAR_WIDTH}px)` : '100%' },
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 1.5, sm: 2 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
