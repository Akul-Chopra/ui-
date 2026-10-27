import { useEffect, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { buildTheme, themeCssVars } from '@/theme/theme';
import { buildNgpsTheme, ngpsCssVars } from '@/theme/ngpsTheme';
import { useUiThemeSync } from '@/lib/useUiThemeSync';
import { useAppDispatch, useAppSelector } from '@/store';
import { startupChecked } from '@/store/authSlice';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';
import { Toast } from '@/components/Toast';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { AppShell } from '@/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { ApprovalsPage } from '@/pages/ApprovalsPage';
import { VendorsPage } from '@/pages/VendorsPage';
import { VendorChangeRequestsPage } from '@/pages/VendorChangeRequestsPage';
import { ContractsPage } from '@/pages/ContractsPage';
import { ContractDetailPage } from '@/pages/ContractDetailPage';
import { WorkOrdersPage } from '@/pages/WorkOrdersPage';
import { WorkOrderDetailPage } from '@/pages/WorkOrderDetailPage';
import { InvoicesPage, InvoiceDetailPage } from '@/pages/InvoicesPage';
import { SanctionOrderPreparationPage } from '@/pages/SanctionOrderPreparationPage';
import { SanctionOrdersPage } from '@/pages/SanctionOrdersPage';
import { SanctionOrderDetailPage } from '@/pages/SanctionOrderDetailPage';
import { RuleEnginePage } from '@/pages/RuleEnginePage';
import { WorkflowsPage } from '@/pages/WorkflowsPage';
import { MastersPage } from '@/pages/MastersPage';
import { SmsSettingsPage } from '@/pages/SmsSettingsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AdminPage } from '@/pages/AdminPage';
import { AuditPage } from '@/pages/AuditPage';

/** Redirects to sign-in unless authenticated. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialised } = useAuth();
  if (!initialised) return null;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Sends a user without any of the permissions back to the dashboard instead of a 403. */
function RequirePermission({ codes, children }: { codes: string[]; children: React.ReactNode }) {
  const { can } = useAuth();
  return can(...codes) ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export function App() {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((s) => s.ui.themeMode);
  const uiTheme = useAppSelector((s) => s.ui.uiTheme);
  const uiThemeKnown = useAppSelector((s) => s.ui.uiThemeKnown);
  const user = useAppSelector((s) => s.auth.user);

  // The profile is rehydrated from storage in the slice's initial state, so the startup
  // check only needs to mark the guard ready; a user with a cached session stays signed
  // in across a refresh, and one without lands on sign-in.
  useEffect(() => {
    dispatch(startupChecked());
  }, [dispatch]);

  // The application look (VPS or NGPS) is a global setting the Super Admin switches; it is
  // cached locally, so a refresh paints the right one without a flash of the other.
  useUiThemeSync();

  // In the VPS look the theme is tinted by the signed-in tenant's brand colour, so switching
  // tenant re-skins the whole console — the most visible proof of multi-tenancy in the demo.
  // The NGPS look keeps the NGPS identity colours.
  const isNgps = uiTheme.mode === 'NGPS';
  const theme = useMemo(
    () =>
      isNgps
        ? buildNgpsTheme(themeMode, uiTheme.ngps)
        : buildTheme(themeMode, user?.tenant.primaryColor, user?.tenant.secondaryColor),
    [isNgps, uiTheme.ngps, themeMode, user?.tenant.primaryColor, user?.tenant.secondaryColor]
  );

  // The mode as data + CSS variables for Tailwind's dark selector and the page CSS. Set in
  // render rather than an effect, so the first paint already has them.
  const cssVars = isNgps ? ngpsCssVars(themeMode, uiTheme.ngps) : themeCssVars(themeMode);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div id="vps-root" data-theme={themeMode} data-ui-theme={uiTheme.mode} style={cssVars as React.CSSProperties}>
        {/* First visit only (nothing cached): the routes wait until the look is known — at
            most the request timeout — rather than flash the wrong one. */}
        {uiThemeKnown && (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <AppShell>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/approvals" element={<ApprovalsPage />} />
                      <Route path="/vendors" element={<VendorsPage />} />
                      <Route path="/vendor-changes" element={<VendorChangeRequestsPage />} />
                      <Route path="/contracts" element={<ContractsPage />} />
                      <Route path="/contracts/:id" element={<ContractDetailPage />} />
                      <Route path="/work-orders" element={<WorkOrdersPage />} />
                      <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />
                      <Route path="/invoices" element={<InvoicesPage />} />
                      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
                      {/* Payment Queue is now the first Reports tab; old links land there. */}
                      <Route path="/finance/queue" element={<Navigate to="/reports?tab=payment-queue" replace />} />
                      <Route path="/finance/ngps/prepare" element={<SanctionOrderPreparationPage />} />
                      <Route path="/finance/ngps/sanction-orders" element={<SanctionOrdersPage />} />
                      <Route path="/finance/ngps/sanction-orders/:id" element={<SanctionOrderDetailPage />} />
                      <Route path="/payments" element={<Navigate to="/reports?tab=payment-queue" replace />} />
                      <Route path="/config/rules" element={<RuleEnginePage />} />
                      <Route path="/config/workflows" element={<WorkflowsPage />} />
                      <Route path="/config/masters" element={<MastersPage />} />
                      <Route
                        path="/config/sms"
                        element={
                          <RequirePermission codes={[Permissions.smsManage]}>
                            <SmsSettingsPage />
                          </RequirePermission>
                        }
                      />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/admin" element={<AdminPage />} />
                      <Route path="/audit" element={<AuditPage />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </AppShell>
                </RequireAuth>
              }
            />
          </Routes>
        )}
        <Toast />
      </div>
    </ThemeProvider>
  );
}
