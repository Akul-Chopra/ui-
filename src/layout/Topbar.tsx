import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Divider,
  ListItemIcon,
  Chip,
} from '@mui/material';
import { Menu as MenuIcon, LightMode, DarkMode, Logout, Person, Domain, LockReset } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleTheme, toggleSidebar } from '@/store/uiSlice';
import { signedOut } from '@/store/authSlice';
import { authApi } from '@/api/endpoints';
import { useAuth } from '@/lib/useAuth';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';

/** Roles listed in the account menu before the rest fold into "+N more". */
const ROLES_SHOWN = 4;

/** FINANCE_OFFICER -> Finance Officer. */
const roleLabel = (code: string) =>
  code
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export function Topbar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const themeMode = useAppSelector((s) => s.ui.themeMode);
  const { user } = useAuth();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [showAllRoles, setShowAllRoles] = useState(false);

  const roles = user?.roles ?? [];
  const visibleRoles = showAllRoles ? roles : roles.slice(0, ROLES_SHOWN);
  const hiddenRoleCount = roles.length - visibleRoles.length;

  const initials = (user?.fullName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(-2)
    .join('')
    .toUpperCase();

  const signOut = async () => {
    // Audit the logout and revoke refresh tokens while the session token is still present;
    // best-effort, so a failure never blocks the user from signing out.
    try {
      await authApi.logout();
    } catch {
      /* ignore — sign out locally regardless */
    }
    dispatch(signedOut());
    navigate('/login');
  };

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        borderBottom: (t) => `1px solid ${t.palette.divider}`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <IconButton edge="start" onClick={() => dispatch(toggleSidebar())} aria-label="menu">
          <MenuIcon />
        </IconButton>

        {/* The tenant name, front and centre, so there is never any doubt which ministry's
            data is on screen. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Domain color="primary" fontSize="small" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {user?.tenant.name ?? 'Vendor Payment System'}
            </Typography>
            {user?.tenant.ministryName && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
                {user.tenant.ministryName}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ flex: 1 }} />

        {user?.vendorId && (
          <Chip label="Vendor Portal" color="secondary" size="small" sx={{ mr: 1 }} />
        )}

        <Tooltip title={themeMode === 'light' ? 'Dark theme' : 'Light theme'}>
          <IconButton onClick={() => dispatch(toggleTheme())}>
            {themeMode === 'light' ? <DarkMode /> : <LightMode />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Account">
          <IconButton onClick={(e) => setAnchor(e.currentTarget)} sx={{ ml: 0.5 }}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}>
              {initials}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={() => {
            setAnchor(null);
            setShowAllRoles(false);
          }}
          // A fixed width, so an account with many roles wraps instead of stretching the menu.
          slotProps={{ paper: { sx: { width: 320, maxWidth: 'calc(100vw - 32px)' } } }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2" noWrap title={user?.fullName}>
              {user?.fullName}
            </Typography>
            {roles.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                {visibleRoles.map((role) => (
                  <Chip key={role} label={roleLabel(role)} size="small" variant="outlined" />
                ))}
                {hiddenRoleCount > 0 && (
                  <Chip
                    label={`+${hiddenRoleCount} more`}
                    size="small"
                    color="primary"
                    variant="outlined"
                    onClick={() => setShowAllRoles(true)}
                  />
                )}
              </Box>
            )}
          </Box>
          <Divider />
          <MenuItem disabled>
            <ListItemIcon>
              <Person fontSize="small" />
            </ListItemIcon>
            <Typography variant="inherit" noWrap title={user?.email}>
              {user?.email}
            </Typography>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAnchor(null);
              setChangePasswordOpen(true);
            }}
          >
            <ListItemIcon>
              <LockReset fontSize="small" />
            </ListItemIcon>
            Change password
          </MenuItem>
          <MenuItem onClick={signOut}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>

        <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      </Toolbar>
    </AppBar>
  );
}
