import { Permissions } from '@/lib/permissions';

export interface NavItem {
  label: string;
  route: string;
  icon: string; // Material icon name, resolved by the sidebar
  /** Any one of these permissions reveals the item. Empty means always visible. */
  permissions: string[];
  /** Show only to vendor-portal users (e.g. their self-service reports). */
  vendorOnly?: boolean;
  /** Hide from vendor-portal users (an officer-only affordance). */
  hideForVendor?: boolean;
  /** Opens the NGPS single sign-on dialog instead of navigating to `route`. */
  ngpsSso?: boolean;
  /**
   * Show only to NGPS signatories (Maker / Checker): the account's linked NGPS user must be a
   * signatory. Checked against the server, which enforces the same rule on every request.
   */
  ngpsSignatory?: boolean;
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

// The navigation the client would otherwise hard-code. Each item names the permission that
// reveals it, so the sidebar a user sees is derived from their grants — the same principle
// the backend applies to the menu_item table, kept here so the SPA needs no extra call
// before its first paint.
export const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', route: '/dashboard', icon: 'Dashboard', permissions: [Permissions.dashboardView] },
      // The personal approval inbox — officers only. Approvals are internal to the agency,
      // so a vendor never sees the approval flow.
      { label: 'Approvals', route: '/approvals', icon: 'FactCheck', permissions: [], hideForVendor: true },
    ],
  },
  {
    heading: 'Procurement',
    items: [
      // A vendor manages only their own record, shown as "My Profile"; officers get the
      // full "Vendors" register and the change-request review queue.
      { label: 'My Profile', route: '/vendors', icon: 'Store', permissions: [], vendorOnly: true },
      { label: 'Vendors', route: '/vendors', icon: 'Store', permissions: [Permissions.vendorView], hideForVendor: true },
      {
        label: 'Change Requests',
        route: '/vendor-changes',
        icon: 'ManageAccounts',
        // vendor.update, not the much broader vendor.view — this is the review queue, gated
        // to the same permission ReviewVendorChangeRequestCommand actually requires to act
        // on a (non-bank-detail) request, not to everyone who can merely look up a vendor.
        permissions: [Permissions.vendorUpdate],
        hideForVendor: true,
      },
      { label: 'Contracts', route: '/contracts', icon: 'Description', permissions: [Permissions.contractView] },
      { label: 'Purchase Orders / Work Orders', route: '/work-orders', icon: 'Assignment', permissions: [Permissions.workOrderView] },
    ],
  },
  {
    heading: 'Payments',
    items: [
      { label: 'Invoices', route: '/invoices', icon: 'ReceiptLong', permissions: [Permissions.invoiceView] },
      {
        label: 'Payment Queue',
        route: '/finance/queue',
        icon: 'Payments',
        permissions: [Permissions.paymentQueueView],
      },
      {
        label: 'Record Payment',
        route: '/finance/record-payment',
        icon: 'PriceCheck',
        permissions: [Permissions.paymentRecord],
        hideForVendor: true,
      },
      {
        label: 'Prepare NGPS Order',
        route: '/finance/ngps/prepare',
        icon: 'PlaylistAddCheck',
        permissions: [Permissions.paymentNgpsPrepare],
        hideForVendor: true,
        ngpsSignatory: true,
      },
      {
        label: 'NGPS Sanction Orders',
        route: '/finance/ngps/sanction-orders',
        icon: 'AccountBalance',
        permissions: [Permissions.paymentNgpsPrepare],
        hideForVendor: true,
        ngpsSignatory: true,
      },
      {
        label: 'Pay via NGPS',
        // Never routed to; it only gives the item a unique key and a path that is never "active".
        route: '/external/ngps-payment',
        icon: 'OpenInNew',
        permissions: [Permissions.paymentRecord],
        hideForVendor: true,
        ngpsSso: true,
      },
      // Vendor self-service reports (their own invoices / payments / contracts).
      { label: 'My Reports', route: '/reports', icon: 'Assessment', permissions: [], vendorOnly: true },
    ],
  },
  {
    heading: 'Oversight',
    items: [
      { label: 'Rule Engine', route: '/config/rules', icon: 'Rule', permissions: [Permissions.ruleView] },
      { label: 'Workflows', route: '/config/workflows', icon: 'AccountTree', permissions: [Permissions.workflowView] },
      { label: 'Master Data', route: '/config/masters', icon: 'Category', permissions: [Permissions.masterManage] },
      { label: 'Reports', route: '/reports', icon: 'Assessment', permissions: [Permissions.reportView], hideForVendor: true },
      { label: 'Audit Trail', route: '/audit', icon: 'History', permissions: [Permissions.auditView] },
    ],
  },
  {
    heading: 'Administration',
    items: [
      {
        label: 'Users & Roles',
        route: '/admin',
        icon: 'AdminPanelSettings',
        permissions: [Permissions.userView, Permissions.roleView],
      },
      // Platform-wide (sender id, DLT templates), so only the Super Admin holds this.
      { label: 'SMS Notifications', route: '/config/sms', icon: 'Sms', permissions: [Permissions.smsManage] },
    ],
  },
];
