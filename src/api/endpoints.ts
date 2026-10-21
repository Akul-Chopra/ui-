import { api } from './client';
import type {
  ActOnApprovalResult,
  ApprovalTask,
  AuthResponse,
  Dashboard,
  AgeingReport,
  ApprovalPerformanceRow,
  ContractExpiryRow,
  MyInvoicesReport,
  MyPaymentsReport,
  MyContractsReport,
  OfficerScorecardRow,
  OfficerWorkloadRow,
  OfficerResponsivenessRow,
  VendorSummaryRow,
  TopVendorRow,
  PaymentSummaryGrouping,
  PaymentSummaryReport,
  TaxDeductionReport,
  EntityTimeline,
  AuditEntry,
  InvoiceDetail,
  InvoiceReviewContext,
  InvoicePayment,
  RecordPaymentBody,
  InvoiceListItem,
  LoginRequest,
  Lookups,
  MasterType,
  MasterItem,
  GstinLookupResult,
  RegisterVendorBody,
  RegisterVendorResult,
  PagedResult,
  PaymentQueueItem,
  SanctionCandidate,
  SanctionOrderDetail,
  SanctionOrderListItem,
  SanctionOrderPreview,
  SanctionOrderSetup,
  SanctionOrderSubmitResult,
  SanctionOrderSyncResult,
  ContractDetail,
  ContractListItem,
  DocumentFile,
  RuleFact,
  RuleSetDetail,
  RuleSetSummary,
  SetThresholdResult,
  SimulateResult,
  VendorChangeRequest,
  VendorDetail,
  VendorListItem,
  WorkflowDefinitionDetail,
  WorkflowDefinitionSummary,
  WorkflowProgress,
  WorkOrderDetail,
  WorkOrderListItem,
} from './types';

const V1 = '/api/v1';

/** Serialises a filter object into a query string, dropping empty values. */
function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, String(value));
    }
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const authApi = {
  login: (body: LoginRequest) =>
    api.post<AuthResponse>(`${V1}/auth/login`, body).then((r) => r.data),
  /** Revokes refresh tokens and audits the logout. Best-effort — ignore failure on sign-out. */
  logout: () => api.post(`${V1}/auth/logout`).then((r) => r.data),
};

export const lookupsApi = {
  /** A platform Super Admin may pass another organisation's tenant id to fetch its lookups. */
  get: (tenantId?: string) =>
    api
      .get<Lookups>(`${V1}/lookups`, tenantId ? { headers: { 'X-Tenant-Id': tenantId } } : undefined)
      .then((r) => r.data),
};

export interface AssignableUser {
  id: string;
  fullName: string;
  email?: string;
  roleId: string;
}

export interface PendingApprover {
  id: string;
  fullName: string;
}

export const usersApi = {
  /** Active users; each row is a (user, role) pairing so the client can group by role. */
  list: () => api.get<AssignableUser[]>(`${V1}/users`).then((r) => r.data),
  /**
   * Officers a document may be pending with — only users with an open approval task, no
   * vendors. Pass an entityType (0 Contract, 1 Work Order, 2 Invoice, 3 Payment) to scope
   * to one document type; omit it for the cross-cutting approvals view.
   */
  pendingApprovers: (entityType?: number) =>
    api
      .get<PendingApprover[]>(`${V1}/users/pending-approvers${qs({ entityType })}`)
      .then((r) => r.data),
  /** Self-service — changes the signed-in user's own password. */
  changeMyPassword: (body: { currentPassword: string; newPassword: string }) =>
    api.put(`${V1}/users/me/password`, body).then((r) => r.data),
};

// ---- Administration (users / roles / designations, optionally cross-org) ----

export interface AdminTenant {
  id: string;
  code: string;
  name: string;
  ministryName?: string;
  status: number;
}

export interface CreateTenantBody {
  code: string;
  name: string;
  legalName?: string;
  ministryName?: string;
  gstin?: string;
  pan?: string;
  tan?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface CreateTenantResult {
  tenantId: string;
  code: string;
  name: string;
}

export interface AdminUserRow {
  id: string;
  fullName: string;
  userName: string;
  email: string;
  mobile?: string;
  designation?: string;
  departmentName?: string;
  roles?: string;
  status: number;
}

export interface AdminRoleRow {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystemRole: boolean;
  hierarchyLevel: number;
  isActive: boolean;
  permissionCount: number;
  userCount: number;
}

export interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
  description?: string;
}

export interface AdminDesignation {
  id: string;
  code: string;
  name: string;
  grade: number;
  description?: string;
  isActive: boolean;
}

export interface CreateUserBody {
  fullName: string;
  userName: string;
  email: string;
  mobile?: string;
  password: string;
  designationId?: string;
  departmentId?: string;
  roleIds: string[];
}

export interface CreateRoleBody {
  code: string;
  name: string;
  description?: string;
  hierarchyLevel: number;
  permissionIds: string[];
}

export interface CreateDesignationBody {
  code: string;
  name: string;
  grade: number;
  description?: string;
}

/**
 * A Super Admin can administer any organisation by passing its tenant id; the backend
 * honours the X-Tenant-Id override only for platform admins. Org admins omit it and act on
 * their own organisation (from their token).
 */
const forTenant = (tenantId?: string) =>
  tenantId ? { headers: { 'X-Tenant-Id': tenantId } } : undefined;

export const adminApi = {
  tenants: () => api.get<AdminTenant[]>(`${V1}/tenants`).then((r) => r.data),
  createTenant: (body: CreateTenantBody) =>
    api.post<CreateTenantResult>(`${V1}/tenants`, body).then((r) => r.data),

  listUsers: (tenantId?: string) =>
    api.get<AdminUserRow[]>(`${V1}/users/manage`, forTenant(tenantId)).then((r) => r.data),
  createUser: (body: CreateUserBody, tenantId?: string) =>
    api.post<string>(`${V1}/users`, body, forTenant(tenantId)).then((r) => r.data),
  /** Sets a user's password directly — no knowledge of the old one required. */
  resetPassword: (userId: string, newPassword: string, tenantId?: string) =>
    api.post(`${V1}/users/${userId}/reset-password`, { newPassword }, forTenant(tenantId)).then((r) => r.data),

  listRoles: (tenantId?: string) =>
    api.get<AdminRoleRow[]>(`${V1}/roles`, forTenant(tenantId)).then((r) => r.data),
  permissionCatalogue: (tenantId?: string) =>
    api.get<PermissionItem[]>(`${V1}/roles/permissions`, forTenant(tenantId)).then((r) => r.data),
  createRole: (body: CreateRoleBody, tenantId?: string) =>
    api.post<string>(`${V1}/roles`, body, forTenant(tenantId)).then((r) => r.data),

  listDesignations: (tenantId?: string) =>
    api.get<AdminDesignation[]>(`${V1}/designations`, forTenant(tenantId)).then((r) => r.data),
  createDesignation: (body: CreateDesignationBody, tenantId?: string) =>
    api.post<string>(`${V1}/designations`, body, forTenant(tenantId)).then((r) => r.data),
};

export interface MyDelegation {
  delegateUserId: string;
  delegateName: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}

export const delegationsApi = {
  mine: () =>
    api.get<MyDelegation>(`${V1}/delegations/me`).then((r) => (r.status === 204 ? null : r.data)),
  /** Colleagues sharing the user's role(s) — eligible delegates. */
  candidates: () => api.get<AssignableUser[]>(`${V1}/delegations/candidates`).then((r) => r.data),
  set: (body: { delegateUserId: string; fromDate: string; toDate: string; reason?: string }) =>
    api.put(`${V1}/delegations/me`, body).then((r) => r.data),
  end: () => api.delete(`${V1}/delegations/me`).then((r) => r.data),
};

export const mastersApi = {
  list: (type: MasterType) =>
    api.get<MasterItem[]>(`${V1}/config/masters`, { params: { type } }).then((r) => r.data),
  save: (body: Partial<MasterItem> & { type: MasterType }) =>
    api.put<string>(`${V1}/config/masters`, body).then((r) => r.data),
  remove: (type: MasterType, id: string) =>
    api.delete(`${V1}/config/masters/${id}`, { params: { type } }).then((r) => r.data),
};

/** Advanced-search filters shared by the personal and org-wide approval inboxes. */
export interface ApprovalSearchParams {
  searchTerm?: string;
  entityType?: number;
  vendorId?: string;
  minAmount?: string;
  maxAmount?: string;
  assignedFrom?: string;
  assignedTo?: string;
  isOverdue?: boolean;
  // Same shape as ListParams: lets the object pass straight into qs()'s Record signature.
  [key: string]: unknown;
}

export const approvalsApi = {
  mine: (params: ApprovalSearchParams = {}) =>
    api.get<ApprovalTask[]>(`${V1}/approvals${qs(params)}`).then((r) => r.data),
  /** Org-wide pending pipeline; optionally narrowed to the tasks pending with one user. */
  all: (pendingWith: string | undefined, params: ApprovalSearchParams = {}) =>
    api
      .get<ApprovalTask[]>(`${V1}/approvals/all${qs({ pendingWith, ...params })}`)
      .then((r) => r.data),
  act: (
    taskId: string,
    body: {
      action: 'Approve' | 'Reject' | 'Return';
      remarks?: string;
      nextApproverUserId?: string;
      returnToUserId?: string;
    }
  ) => api.post<ActOnApprovalResult>(`${V1}/approvals/${taskId}/act`, body).then((r) => r.data),
  reassign: (taskId: string, body: { newUserId: string; remarks?: string }) =>
    api.post(`${V1}/approvals/${taskId}/reassign`, body).then((r) => r.data),
  /** Users eligible to take this task — those holding the step's role. */
  reassignCandidates: (taskId: string) =>
    api.get<AssignableUser[]>(`${V1}/approvals/${taskId}/candidates`).then((r) => r.data),
  /** Active officers in the org, for the manual-routing pickers. */
  officers: () => api.get<Officer[]>(`${V1}/approvals/officers`).then((r) => r.data),
  /** Every active internal user in the organisation, for the "Return to" picker. */
  orgUsers: () => api.get<OrgUser[]>(`${V1}/approvals/org-users`).then((r) => r.data),
};

// Attachments. Owner type is the DocumentOwnerType enum name (Vendor, Contract, WorkOrder…).
export const documentsApi = {
  list: (ownerType: string, ownerId: string) =>
    api
      .get<DocumentFile[]>(`${V1}/documents${qs({ ownerType, ownerId })}`)
      .then((r) => r.data),
  upload: (ownerType: string, ownerId: string, file: File, description?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('ownerType', ownerType);
    fd.append('ownerId', ownerId);
    if (description) fd.append('description', description);
    return api
      .post<{ id: string; originalFileName: string; fileSizeBytes: number }>(`${V1}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  // Streams the file with the auth header, then hands back a blob the caller saves.
  download: (id: string) =>
    api.get(`${V1}/documents/${id}/download`, { responseType: 'blob' }).then((r) => r.data as Blob),
  // Reads a Word/text draft and returns the fields it can pull out (nothing is stored).
  extractFields: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post<ExtractedDocumentFields>(`${V1}/documents/extract-fields`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

export interface ExtractedDocumentFields {
  title?: string;
  description?: string;
  scopeOfWork?: string;
  paymentTerms?: string;
  termsAndConditions?: string;
  complianceTerms?: string;
  indemnificationTerms?: string;
  disputeResolution?: string;
  amount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  signedDate?: string | null;
  gstin?: string | null;
  invoiceNumber?: string | null;
  vendorName?: string | null;
  contractReference?: string | null;
  deliveryLocation?: string | null;
  workOrderNumber?: string | null;
  department?: string | null;
  vertical?: string | null;
  category?: string | null;
  contractSelectionMode?: string | null;
  contractFor?: string | null;
  slas?: ExtractedSlaRow[];
  rawText: string;
}

export interface ExtractedSlaRow {
  metric: string;
  measurementPeriod?: string | null;
  targetValue?: string | null;
  failureCondition?: string | null;
  deductionType?: string | null;
  deductionValue?: number | null;
  penaltyPeriod?: string | null;
}

export const vendorChangeRequestsApi = {
  list: (status?: string) =>
    api.get<VendorChangeRequest[]>(`${V1}/vendors/change-requests${qs({ status })}`).then((r) => r.data),
  raise: (body: RaiseVendorChangeBody) =>
    api.post<{ id: string; requestType: string; message: string }>(
      `${V1}/vendors/change-requests`,
      body
    ).then((r) => r.data),
  review: (id: string, body: { approve: boolean; remarks?: string }) =>
    api.post<{ id: string; status: string; message: string }>(
      `${V1}/vendors/change-requests/${id}/review`,
      body
    ).then((r) => r.data),
};

export interface RaiseVendorChangeBody {
  vendorId?: string;
  requestType: 'Contact' | 'BankAccount';
  reason?: string;
  newContactPersonName?: string;
  newMobile?: string;
  newAlternatePhone?: string;
  newEmail?: string;
  newAccountHolderName?: string;
  newAccountNumber?: string;
  newIfscCode?: string;
  newBankName?: string;
  newBranchName?: string;
  newAccountType?: string;
}

// ---- Create/action payload shapes ----------------------------------------

export interface VerifyVendorBody {
  isApproved: boolean;
  gstVerified: boolean;
  panVerified: boolean;
  bankVerified: boolean;
  remarks?: string;
}

export interface ContractSlaInput {
  metric: string;
  measurementPeriod: 'Days' | 'Weekly' | 'Monthly' | 'Yearly';
  targetValue?: string;
  failureCondition?: string;
  deductionType: 'Percentage' | 'FixedAmount';
  deductionValue: number;
  penaltyPeriod: 'Days' | 'Weekly' | 'Monthly' | 'Yearly';
  /** Upper limit on the penalty as a percentage (e.g. capped at 10%); omit for uncapped. */
  penaltyCapPercentage?: number;
  remarks?: string;
}

export interface CreateContractBody {
  title: string;
  description?: string;
  vendorId: string;
  departmentId?: string;
  verticalId?: string;
  contractCategoryId?: string;
  contractSelectionModeId?: string;
  contractForId?: string;
  contractForOther?: string;
  contractValue: number;
  startDate: string;
  endDate: string;
  signedDate?: string;
  slas?: ContractSlaInput[];
  scopeOfWork?: string;
  termsAndConditions?: string;
  paymentTerms?: string;
  complianceTerms?: string;
  indemnificationTerms?: string;
  disputeResolution?: string;
  retentionPercentage?: number;
  securityDepositAmount?: number;
  sdInstrumentType?: string;
  sdInstrumentNumber?: string;
  sdInstrumentDate?: string;
  sdInstrumentValidityDate?: string;
  isRenewable?: boolean;
  /** How many months the contract renews for, e.g. 3. Meaningful only when isRenewable. */
  renewalPeriodMonths?: number;
  remarks?: string;
}

/** Body for correcting a contract in place — same shape as creation, minus the SLA list
 * (SLAs are not part of this correction tool). No versioning; the running approval is
 * left unaffected. */
export type UpdateContractBody = Omit<CreateContractBody, 'slas'>;

export interface CreateWorkOrderLine {
  itemDescription: string;
  hsnSacCode?: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  gstRate: number;
  remarks?: string;
}

/** How invoices are generated against a work order. */
export type PaymentScheduleType = 'OneTime' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Milestone';

/** A billing milestone defined on a milestone-based work order. */
export interface CreateWorkOrderMilestone {
  name: string;
  description?: string;
  amount: number;
  /** ISO date the milestone falls due; billing is allowed on or after it. */
  dueDate?: string;
}

export interface CreateWorkOrderBody {
  title: string;
  /** Optional: record an already-issued work order number; blank auto-generates one. */
  workOrderNumber?: string;
  description?: string;
  contractId?: string;
  vendorId: string;
  departmentId: string;
  startDate: string;
  expectedCompletionDate: string;
  deliveryLocation?: string;
  scopeOfWork?: string;
  termsAndConditions?: string;
  securityDepositAmount?: number;
  sdInstrumentType?: string;
  sdInstrumentNumber?: string;
  sdInstrumentDate?: string;
  sdInstrumentValidityDate?: string;
  /** What the order's amount represents — a firm 'TenderedValue', or an 'AverageValue' for a
   * variable-consumption order (e.g. electricity billing). */
  amountType?: 'TenderedValue' | 'AverageValue';
  /** How invoices are generated against this order. Defaults to one-time. */
  paymentScheduleType?: PaymentScheduleType;
  /** Required when paymentScheduleType is 'Milestone'; must sum to the order value. */
  milestones?: CreateWorkOrderMilestone[];
  /** The order's own service levels — accepted only when it cites no contract. */
  slas?: ContractSlaInput[];
  lineItems: CreateWorkOrderLine[];
  remarks?: string;
}


/** Body for correcting a work order in place — its own header fields, value and vendor
 * only. Line items, milestones and the citing contract are out of scope for this
 * correction tool. No versioning; the running approval is left unaffected. */
export interface UpdateWorkOrderBody {
  title: string;
  description?: string;
  vendorId: string;
  departmentId: string;
  startDate: string;
  expectedCompletionDate: string;
  deliveryLocation?: string;
  scopeOfWork?: string;
  termsAndConditions?: string;
  securityDepositAmount?: number;
  sdInstrumentType?: string;
  sdInstrumentNumber?: string;
  sdInstrumentDate?: string;
  sdInstrumentValidityDate?: string;
  amountType?: 'TenderedValue' | 'AverageValue';
  totalAmount: number;
  remarks?: string;
}

export interface SubmitInvoiceBody {
  workOrderId: string;
  vendorInvoiceNumber: string;
  vendorInvoiceDate: string;
  /** Set for a milestone-based work order. */
  milestoneId?: string;
  /** Billing period, for a periodic work order. For quarterly billing the month is the quarter's first month. */
  billingYear?: number;
  billingMonth?: number;
  /** Taxable value of the claim (before GST), in rupees. */
  baseAmount: number;
  /** GST charged on the claim, in rupees (split into CGST/SGST or IGST server-side). */
  gstAmount: number;
  remarks?: string;
}

export const dashboardApi = {
  /** activityUserId (admins only) filters the Recent Activity feed to one user. */
  get: (activityUserId?: string) =>
    api.get<Dashboard>(`${V1}/dashboard${qs({ activityUserId })}`).then((r) => r.data),
};

export const reportsApi = {
  paymentSummary: (params: {
    groupBy: PaymentSummaryGrouping;
    financialYear?: string;
    departmentId?: string;
    vendorId?: string;
    fromDate?: string;
    toDate?: string;
  }) =>
    api
      .get<PaymentSummaryReport>(`${V1}/reports/payment-summary${qs(params)}`)
      .then((r) => r.data),
  ageing: (params: { departmentId?: string; vendorId?: string } = {}) =>
    api.get<AgeingReport>(`${V1}/reports/ageing${qs(params)}`).then((r) => r.data),
  taxDeduction: (params: { financialYear?: string; departmentId?: string } = {}) =>
    api.get<TaxDeductionReport>(`${V1}/reports/tax-deduction${qs(params)}`).then((r) => r.data),
  approvalPerformance: () =>
    api
      .get<ApprovalPerformanceRow[]>(`${V1}/reports/approval-performance`)
      .then((r) => r.data),
  contractExpiry: () =>
    api.get<ContractExpiryRow[]>(`${V1}/reports/contract-expiry`).then((r) => r.data),
  officerScorecard: () =>
    api.get<OfficerScorecardRow[]>(`${V1}/reports/officer-scorecard`).then((r) => r.data),
  officerWorkload: () =>
    api.get<OfficerWorkloadRow[]>(`${V1}/reports/officer-workload`).then((r) => r.data),
  officerResponsiveness: () =>
    api
      .get<OfficerResponsivenessRow[]>(`${V1}/reports/officer-responsiveness`)
      .then((r) => r.data),
  vendorSummary: () => api.get<VendorSummaryRow[]>(`${V1}/reports/vendor-summary`).then((r) => r.data),
  topVendors: () => api.get<TopVendorRow[]>(`${V1}/reports/top-vendors`).then((r) => r.data),
  // Vendor self-service — auto-scoped to the signed-in vendor server-side.
  myInvoices: () => api.get<MyInvoicesReport>(`${V1}/reports/my-invoices`).then((r) => r.data),
  myPayments: () => api.get<MyPaymentsReport>(`${V1}/reports/my-payments`).then((r) => r.data),
  myContracts: () => api.get<MyContractsReport>(`${V1}/reports/my-contracts`).then((r) => r.data),
};

export interface ListParams {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  sortBy?: string;
  sortDescending?: boolean;
  status?: string;
  /** Restrict a list to items with an approval step currently pending on the signed-in user. */
  pendingWithMe?: boolean;
  /** Restrict a list to items whose current approval step is pending with this user id. */
  pendingWithUserId?: string;
  [key: string]: unknown;
}

export const vendorsApi = {
  list: (params: ListParams) =>
    api.get<PagedResult<VendorListItem>>(`${V1}/vendors${qs(params)}`).then((r) => r.data),
  get: (id: string) => api.get<VendorDetail>(`${V1}/vendors/${id}`).then((r) => r.data),
  verify: (id: string, body: VerifyVendorBody) =>
    api.post(`${V1}/vendors/${id}/verify`, body).then((r) => r.data),
  blacklist: (id: string, body: { blacklist: boolean; reason: string; blacklistedUntil?: string }) =>
    api.post(`${V1}/vendors/${id}/blacklist`, body).then((r) => r.data),
  lookupGstin: (gstin: string) =>
    api.get<GstinLookupResult>(`${V1}/vendors/gstin/${gstin}`).then((r) => r.data),
  register: (body: RegisterVendorBody) =>
    api.post<RegisterVendorResult>(`${V1}/vendors`, body).then((r) => r.data),
};

export interface CreateContractResult {
  contractId: string;
  contractNumber: string;
}

export const contractsApi = {
  list: (params: ListParams) =>
    api.get<PagedResult<ContractListItem>>(`${V1}/contracts${qs(params)}`).then((r) => r.data),
  get: (id: string) => api.get<ContractDetail>(`${V1}/contracts/${id}`).then((r) => r.data),
  create: (body: CreateContractBody) =>
    api.post<CreateContractResult>(`${V1}/contracts`, body).then((r) => r.data),
  submit: (id: string, body?: SubmitOptions) =>
    api.post<SubmitResult>(`${V1}/contracts/${id}/submit`, body ?? {}).then((r) => r.data),
  update: (id: string, body: UpdateContractBody) =>
    api.put<void>(`${V1}/contracts/${id}`, body).then((r) => r.data),
};

/** Routing choice supplied when submitting a contract or work order for approval. */
export interface SubmitOptions {
  remarks?: string;
  routingMode?: 'Auto' | 'Manual';
  /** Required when routingMode is 'Manual' — the officer it goes to first. */
  firstApproverUserId?: string;
}

/** Who a just-submitted document's approval task landed on, if any (null when it auto-approved with no step). */
export interface SubmitResult {
  pendingWith?: string | null;
}

export interface Officer {
  id: string;
  fullName: string;
  designation?: string;
}

/** Any active internal user in the organisation, for the "Return to" picker. */
export interface OrgUser {
  id: string;
  fullName: string;
  designation?: string;
  departmentName?: string;
}

export interface CreateWorkOrderResult {
  workOrderId: string;
  workOrderNumber: string;
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  contractWasRequired: boolean;
  milestoneCount: number;
  ruleExplanation: string[];
}

export const workOrdersApi = {
  list: (params: ListParams) =>
    api.get<PagedResult<WorkOrderListItem>>(`${V1}/work-orders${qs(params)}`).then((r) => r.data),
  get: (id: string) => api.get<WorkOrderDetail>(`${V1}/work-orders/${id}`).then((r) => r.data),
  create: (body: CreateWorkOrderBody) =>
    api.post<CreateWorkOrderResult>(`${V1}/work-orders`, body).then((r) => r.data),
  submit: (id: string, body?: SubmitOptions) =>
    api.post<SubmitResult>(`${V1}/work-orders/${id}/submit`, body ?? {}).then((r) => r.data),
  publish: (id: string, remarks?: string) =>
    api.post(`${V1}/work-orders/${id}/publish`, { remarks }).then((r) => r.data),
  update: (id: string, body: UpdateWorkOrderBody) =>
    api.put<void>(`${V1}/work-orders/${id}`, body).then((r) => r.data),
};

export interface SubmitInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
}

export const invoicesApi = {
  list: (params: ListParams) =>
    api.get<PagedResult<InvoiceListItem>>(`${V1}/invoices${qs(params)}`).then((r) => r.data),
  get: (id: string) => api.get<InvoiceDetail>(`${V1}/invoices/${id}`).then((r) => r.data),
  reviewContext: (id: string) =>
    api.get<InvoiceReviewContext>(`${V1}/invoices/${id}/review-context`).then((r) => r.data),
  payments: (id: string) =>
    api.get<InvoicePayment[]>(`${V1}/invoices/${id}/payments`).then((r) => r.data),
  recordPayment: (id: string, body: RecordPaymentBody) =>
    api.post(`${V1}/invoices/${id}/record-payment`, body).then((r) => r.data),
  submit: (body: SubmitInvoiceBody) =>
    api.post<SubmitInvoiceResult>(`${V1}/invoices`, body).then((r) => r.data),
  review: (id: string, body: unknown) =>
    api.post(`${V1}/invoices/${id}/review`, body).then((r) => r.data),
  resubmit: (id: string, body: ResubmitInvoiceBody) =>
    api.post(`${V1}/invoices/${id}/resubmit`, body).then((r) => r.data),
  correct: (id: string, body: ResubmitInvoiceBody) =>
    api.put<void>(`${V1}/invoices/${id}`, body).then((r) => r.data),
};

export interface ResubmitInvoiceBody {
  vendorInvoiceNumber: string;
  vendorInvoiceDate: string;
  baseAmount: number;
  gstAmount: number;
  remarks?: string;
}

export const paymentsApi = {
  /** Fresh NGPS sign-in URL for the current officer ("Pay via NGPS"); minted server-side per click. */
  ngpsSso: () => api.post<{ redirectUrl: string }>(`${V1}/payments/ngps-sso`).then((r) => r.data),
  queue: (params: ListParams) =>
    api.get<PagedResult<PaymentQueueItem>>(`${V1}/payments/queue${qs(params)}`).then((r) => r.data),
  createAdvice: (body: unknown) =>
    api.post(`${V1}/payments/advice`, body).then((r) => r.data),
  approve: (id: string, body: unknown) =>
    api.post(`${V1}/payments/${id}/approve`, body).then((r) => r.data),
  disburse: (id: string, body: unknown) =>
    api.post(`${V1}/payments/${id}/disburse`, body).then((r) => r.data),
};

export interface CreateSanctionOrderBody {
  invoiceIds: string[];
  description?: string;
  /** yyyy-MM-dd; defaults to today server-side. */
  sanctionDate?: string;
}

/** NGPS Sanction Orders: prepare, push, and track to the bank's result. */
export const ngpsSanctionOrdersApi = {
  setup: () => api.get<SanctionOrderSetup>(`${V1}/ngps-sanction-orders/setup`).then((r) => r.data),
  candidates: (params: ListParams) =>
    api
      .get<PagedResult<SanctionCandidate>>(`${V1}/ngps-sanction-orders/candidates${qs(params)}`)
      .then((r) => r.data),
  preview: (body: { invoiceIds: string[]; sanctionDate?: string }) =>
    api.post<SanctionOrderPreview>(`${V1}/ngps-sanction-orders/preview`, body).then((r) => r.data),
  create: (body: CreateSanctionOrderBody) =>
    api.post<SanctionOrderSubmitResult>(`${V1}/ngps-sanction-orders`, body).then((r) => r.data),
  list: (params: ListParams) =>
    api.get<PagedResult<SanctionOrderListItem>>(`${V1}/ngps-sanction-orders${qs(params)}`).then((r) => r.data),
  get: (id: string) => api.get<SanctionOrderDetail>(`${V1}/ngps-sanction-orders/${id}`).then((r) => r.data),
  retry: (id: string) =>
    api.post<SanctionOrderSubmitResult>(`${V1}/ngps-sanction-orders/${id}/retry`).then((r) => r.data),
  cancel: (id: string, reason: string) =>
    api.post<SanctionOrderSubmitResult>(`${V1}/ngps-sanction-orders/${id}/cancel`, { reason }).then((r) => r.data),
  sync: (id: string) =>
    api.post<SanctionOrderSyncResult>(`${V1}/ngps-sanction-orders/${id}/sync`).then((r) => r.data),
};

export const rulesApi = {
  sets: () => api.get<RuleSetSummary[]>(`${V1}/config/rules/sets`).then((r) => r.data),
  set: (id: string) => api.get<RuleSetDetail>(`${V1}/config/rules/sets/${id}`).then((r) => r.data),
  facts: (entityType?: string) =>
    api.get<RuleFact[]>(`${V1}/config/rules/facts${qs({ entityType })}`).then((r) => r.data),
  simulate: (id: string, facts: Record<string, string>) =>
    api.post<SimulateResult>(`${V1}/config/rules/sets/${id}/simulate`, facts).then((r) => r.data),
  setThreshold: (conditionId: string, body: { value: string; valueTo?: string; reason?: string }) =>
    api
      .post<SetThresholdResult>(`${V1}/config/rules/conditions/${conditionId}/threshold`, body)
      .then((r) => r.data),
  setActive: (id: string, isActive: boolean) =>
    api.post(`${V1}/config/rules/sets/${id}/active`, { isActive }).then((r) => r.data),
  saveSet: (body: unknown) =>
    api.put<{ id: string; code: string; ruleCount: number; definitionVersion: number }>(
      `${V1}/config/rules/sets`,
      body
    ).then((r) => r.data),
};

export const workflowsApi = {
  list: () =>
    api.get<WorkflowDefinitionSummary[]>(`${V1}/config/workflows`).then((r) => r.data),
  get: (id: string) =>
    api.get<WorkflowDefinitionDetail>(`${V1}/config/workflows/${id}`).then((r) => r.data),
  save: (body: unknown) =>
    api.put<{ id: string; code: string; stepCount: number; definitionVersion: number }>(
      `${V1}/config/workflows`,
      body
    ).then((r) => r.data),
  progress: (entityType: string, entityId: string) =>
    api
      .get<WorkflowProgress>(`${V1}/config/workflows/progress/${entityType}/${entityId}`)
      .then((r) => r.data),
};

export const auditApi = {
  list: (params: ListParams) =>
    api.get<PagedResult<AuditEntry>>(`${V1}/audit${qs(params)}`).then((r) => r.data),
  timeline: (entityName: string, entityId: string) =>
    api.get<EntityTimeline>(`${V1}/audit/timeline/${entityName}/${entityId}`).then((r) => r.data),
};
