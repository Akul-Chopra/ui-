import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Toolbar,
} from '@mui/material';
import {
  Dashboard,
  Store,
  Description,
  Assignment,
  ReceiptLong,
  Rule,
  AccountTree,
  History,
  FactCheck,
  AccountBalance,
  ManageAccounts,
  Category,
  Assessment,
  AdminPanelSettings,
  OpenInNew,
  PlaylistAddCheck,
  Sms,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { navSections, type NavItem } from './navItems';
import { useAuth } from '@/lib/useAuth';
import { useIsNgpsSignatory } from '@/lib/useIsNgpsSignatory';
import { useIsNgpsLinked } from '@/lib/useIsNgpsLinked';
import { useNgpsSso } from '@/lib/useNgpsSso';

const ICONS: Record<string, React.ReactNode> = {
  Dashboard: <Dashboard />,
  Store: <Store />,
  Description: <Description />,
  Assignment: <Assignment />,
  ReceiptLong: <ReceiptLong />,
  Rule: <Rule />,
  AccountTree: <AccountTree />,
  History: <History />,
  FactCheck: <FactCheck />,
  ManageAccounts: <ManageAccounts />,
  Category: <Category />,
  Assessment: <Assessment />,
  AdminPanelSettings: <AdminPanelSettings />,
  OpenInNew: <OpenInNew />,
  PlaylistAddCheck: <PlaylistAddCheck />,
  AccountBalance: <AccountBalance />,
  Sms: <Sms />,
};

export const SIDEBAR_WIDTH = 260;

export function Sidebar({ open, onClose, variant }: { open: boolean; onClose: () => void; variant: 'permanent' | 'temporary' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { can, user, isVendor } = useAuth();
  const isNgpsSignatory = useIsNgpsSignatory();
  const isNgpsLinked = useIsNgpsLinked();
  const ngpsSso = useNgpsSso();

  const go = (item: NavItem) => {
    if (item.ngpsSso) {
      ngpsSso.start();
      return;
    }
    navigate(item.route);
    if (variant === 'temporary') onClose();
  };

  const content = (
    <Box sx={{ width: SIDEBAR_WIDTH, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand block. The tenant name here reinforces which ministry the operator is in. */}
      <Toolbar sx={{ px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <AccountBalance />
          </Box>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              VPS
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.tenant.code?.toUpperCase() ?? 'Vendor Payments'}
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      <Box sx={{ overflowY: 'auto', flex: 1, px: 1, py: 1 }}>
        {navSections.map((section, i) => {
          const visible = section.items.filter((item) => {
            if (item.vendorOnly && !isVendor) return false;
            if (item.hideForVendor && isVendor) return false;
            if (item.ngpsSignatory && !isNgpsSignatory) return false;
            if (item.ngpsSso && !isNgpsLinked) return false;
            return item.permissions.length === 0 || can(...item.permissions);
          });
          if (visible.length === 0) return null;
          return (
            <Box key={i} sx={{ mb: 1 }}>
              {section.heading && (
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ px: 2, fontWeight: 700, letterSpacing: 1 }}
                >
                  {section.heading}
                </Typography>
              )}
              <List dense disablePadding>
                {visible.map((item) => {
                  const active = location.pathname.startsWith(item.route);
                  return (
                    <ListItemButton
                      key={item.route}
                      selected={active}
                      disabled={item.ngpsSso && ngpsSso.busy}
                      onClick={() => go(item)}
                      sx={{
                        borderRadius: 2,
                        mb: 0.25,
                        '&.Mui-selected': {
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                          '&:hover': { bgcolor: 'primary.dark' },
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>{ICONS[item.icon]}</ListItemIcon>
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          );
        })}
      </Box>

      {/* The class is a styling hook for the NGPS look (ngpsTheme.ts); the VPS look has no rule for it. */}
      <Box className="vps-sidebar-footer" sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          National eGovernance Division
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      <Drawer
        variant={variant}
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: variant === 'permanent' ? SIDEBAR_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, boxSizing: 'border-box' },
        }}
      >
        {content}
      </Drawer>
    </>
  );
}
