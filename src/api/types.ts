// Types mirroring the backend DTOs. Kept hand-written rather than generated so the client
// depends only on the fields it uses, and so each type can carry a comment where the shape
// is not self-evident.

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

// ---- Auth ----------------------------------------------------------------

export interface TenantSummary {
  id: string;
  code: string;
  name: string;
  ministryName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  financialYearStartMonth: number;
}

export interface SignedInUser {
  id: string;
  userName: string;
  fullName: string;
  email: string;
  departmentId?: string;
  vendorId?: string;
  tenant: TenantSummary;
  roles: string[];
  permissions: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  mustChangePassword: boolean;
  user: SignedInUser;
}

export interface LoginRequest {
  tenantCode: string;
  login: string;
  password: string;
}

// ---- Problem details (error envelope) ------------------------------------

export interface ProblemDetails {
  title: string;
  status: number;
  detail?: string;
  code?: string;
  correlationId?: string;
  errors?: Record<string, string[]>;
}

// ---- Dashboard -----------------------------------------------------------

export interface DashboardKpis {
  pendingContracts: number;
  pendingWorkOrders: number;
  pendingInvoices: number;
  pendingPayments: number;
  pendingApprovals: number;
  underReview: number;
  todaysPaymentsAmount: number;
  todaysPaymentsCount: number;
  monthlyPaymentsAmount: number;
  financialYearPaymentsAmount: number;
  amountInPaymentQueue: number;
  totalVendors: number;
  totalContracts: number;
  totalWorkOrders: number;
  totalInvoices: number;
  rejectedCount: number;
  cancelledCount: number;
}

export interface MonthlyAmount {
  month: string;
  label: string;
  amount: number;
  count: number;
}

export interface StatusCount {
  statusValue: number;
  label: string;
  tone: string;
  count: number;
  amount: number;
}

export interface NamedAmount {
  id?: string;
  name: string;
  amount: number;
  count: number;
}

export interface PendingTask {
  taskId: string;
  entityType: string;
  entityId: string;
  entityReference?: string;
  stepName: string;
  assignedOn: string;
  dueOn?: string;
  isOverdue: boolean;
}

export interface RecentActivity {
  action: number;
  actionLabel: string;
  entityName: string;
  entityReference?: string;
  userName?: string;
  remarks?: string;
  timestamp: string;
}

export interface Dashboard {
  kpis: DashboardKpis;
  monthlyPayments: MonthlyAmount[];
  invoiceStatusBreakdown: StatusCount[];
  paymentStatusBreakdown: StatusCount[];
  departmentSpend: NamedAmount[];
  contractCategoryValue: NamedAmount[];
  topVendors: NamedAmount[];
  myPendingTasks: PendingTask[];
  recentActivity: RecentActivity[];
  myApprovalStats: MyApprovalStats;
  financialYear: string;
}

/** The signed-in user's own approval activity across time windows. */
export interface MyApprovalStats {
  approvedThisWeek: number;
  approvedThisMonth: number;
  approvedLast6Months: number;
  pendingOverAWeek: number;
  pendingOverAMonth: number;
  pendingOverSixMonths: number;
  overdue: number;
}

// ---- Reports -------------------------------------------------------------

export interface ApprovalPerformanceRow {
  officer: string;
  role?: string;
  pending: number;
  overdue: number;
  clearedThisMonth: number;
  clearedLast6Months: number;
  avgTurnaroundHours?: number;
}

// ---- Vendor self-service reports ----

export interface MyInvoiceRow {
  id: string;
  invoiceNumber: string;
  workOrderNumber?: string;
  status: string;
  grossAmount: number;
  deductionAmount: number;
  netPayableAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  submittedOn?: string;
  dueDate?: string;
  ageInDays: number;
}

export interface MyInvoicesReport {
  rows: MyInvoiceRow[];
  totalGross: number;
  totalDeductions: number;
  totalNetPayable: number;
  totalPaid: number;
  totalOutstanding: number;
}

export interface MyPaymentRow {
  invoiceId: string;
  paymentNumber: string;
  invoiceNumber?: string;
  status: string;
  amount: number;
  disbursedOn?: string;
}

export interface MonthlyReceipt {
  month: string;
  label: string;
  amount: number;
  count: number;
}

export interface MyPaymentsReport {
  rows: MyPaymentRow[];
  monthly: MonthlyReceipt[];
  totalReceived: number;
  totalInProgress: number;
  disbursedCount: number;
}

export interface MyContractRow {
  id: string;
  contractNumber: string;
  title: string;
  status: string;
  contractValue: number;
  committedValue: number;
  disbursedValue: number;
  availableValue: number;
  endDate: string;
  daysToExpiry: number;
  workOrderCount: number;
  invoiceCount: number;
}

export interface MyContractsReport {
  rows: MyContractRow[];
  totalValue: number;
  totalCommitted: number;
  totalDisbursed: number;
}

export interface OfficerScorecardRow {
  officer: string;
  role?: string;
  workload: number;
  completed: number;
  onTime: number;
  late: number;
  pending: number;
  overduePending: number;
  slaCompliancePct?: number;
  avgTurnaroundHours: number;
  adjustedScore: number;
}

export interface OfficerWorkloadRow {
  officer: string;
  role?: string;
  contracts: number;
  workOrders: number;
  invoices: number;
  payments: number;
  totalTasks: number;
  pending: number;
  overdue: number;
}

export interface OfficerResponsivenessRow {
  officer: string;
  role?: string;
  completed: number;
  sameDay: number;
  withinThreeDays: number;
  withinAWeek: number;
  overAWeek: number;
  avgHours: number;
  slowestHours: number;
}

export interface ContractExpiryRow {
  id: string;
  contractNumber: string;
  title: string;
  vendorName: string;
  departmentName?: string;
  contractValue: number;
  availableValue: number;
  endDate: string;
  daysToExpiry: number;
  bucket: string;
}

export interface VendorSummaryRow {
  id: string;
  vendorCode: string;
  legalName: string;
  status: string;
  categoryName?: string;
  rating?: number;
  contracts: number;
  workOrders: number;
  invoices: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
}

export interface TopVendorRow {
  id: string;
  vendorName: string;
  vendorCode: string;
  paymentCount: number;
  totalDisbursed: number;
  lastPaymentOn?: string;
}

export type PaymentSummaryGrouping = 'Vendor' | 'Department' | 'Month' | 'ContractCategory';

export interface PaymentSummaryRow {
  groupId?: string;
  groupName: string;
  invoiceCount: number;
  grossAmount: number;
  deductionAmount: number;
  netPayableAmount: number;
  paidAmount: number;
  outstandingAmount: number;
}

export interface PaymentSummaryReport {
  financialYear: string;
  groupedBy: PaymentSummaryGrouping;
  rows: PaymentSummaryRow[];
  totals: PaymentSummaryRow;
}

export interface AgeingBucket {
  bucket: string;
  count: number;
  outstandingAmount: number;
}

export interface AgeingInvoice {
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  departmentName: string;
  outstandingAmount: number;
  ageInDays: number;
  bucket: string;
  status: string;
}

export interface AgeingReport {
  buckets: AgeingBucket[];
  totalOutstanding: number;
  totalInvoices: number;
  invoices: AgeingInvoice[];
}

export interface DeductionTypeTotal {
  deductionType: number;
  deductionTypeName: string;
  count: number;
  amount: number;
}

export interface TaxDeductionReport {
  financialYear: string;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalGst: number;
  deductionsByType: DeductionTypeTotal[];
  totalDeductions: number;
  msmePaidAmount: number;
  nonMsmePaidAmount: number;
  totalPaidAmount: number;
  msmeSharePercent: number;
}

// ---- Vendors -------------------------------------------------------------

export interface VendorListItem {
  id: string;
  vendorCode: string;
  legalName: string;
  tradeName?: string;
  gstin: string;
  pan: string;
  status: string;
  msmeCategory: string;
  categoryName?: string;
  city: string;
  state: string;
  email: string;
  mobile: string;
  rating?: number;
  isGstVerified: boolean;
  isBankVerified: boolean;
  workOrderCount: number;
  totalPaidAmount: number;
  registrationDate?: string;
}

export interface VendorBankAccount {
  id: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  accountType: string;
  isPrimary: boolean;
  isVerified: boolean;
  isActive: boolean;
}

export interface VendorDetail {
  id: string;
  vendorCode: string;
  legalName: string;
  tradeName?: string;
  categoryName?: string;
  constitution: string;
  status: string;
  gstin: string;
  pan: string;
  msmeCategory: string;
  udyamRegistrationNumber?: string;
  contactPersonName: string;
  email: string;
  mobile: string;
  alternatePhone?: string;
  website?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  stateCode?: string;
  pincode: string;
  isGstVerified: boolean;
  isPanVerified: boolean;
  isBankVerified: boolean;
  verifiedOn?: string;
  rating?: number;
  registrationDate?: string;
  blacklistedOn?: string;
  blacklistReason?: string;
  remarks?: string;
  version: number;
  bankAccounts: VendorBankAccount[];
}

// ---- Lookups (reference data for create forms) ---------------------------

export interface LookupItem {
  id: string;
  code: string;
  name: string;
  /** Only present for contract categories: whether the Cost & Payment section applies. */
  showCostPaymentSection?: boolean | null;
}

export interface Lookups {
  departments: LookupItem[];
  vendorCategories: LookupItem[];
  contractCategories: LookupItem[];
  verticals: LookupItem[];
  contractSelectionModes: LookupItem[];
  contractFors: LookupItem[];
  roles: LookupItem[];
}

// ---- Vendor GST lookup & officer registration --------------------------------

export interface GstTaxpayerDetails {
  gstin: string;
  pan: string;
  legalName: string;
  tradeName?: string | null;
  constitution: string;
  constitutionText?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  status?: string | null;
  isActive: boolean;
}

export interface ExistingVendorSummary {
  vendorId: string;
  vendorCode: string;
  legalName: string;
  status: string;
}

export interface GstinLookupResult {
  gst: GstTaxpayerDetails | null;
  alreadyRegistered: ExistingVendorSummary | null;
}

export interface RegisterVendorBody {
  legalName: string;
  tradeName?: string;
  vendorCategoryId?: string;
  constitution: string;
  gstin: string;
  pan: string;
  cin?: string;
  tanNumber?: string;
  entityType?: string;
  contactPersonName: string;
  email: string;
  mobile: string;
  alternatePhone?: string;
  website?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  remarks?: string;
}

export interface RegisterVendorResult {
  vendorId: string;
  vendorCode: string;
  status: string;
}

/** The master catalogues a super user can maintain. Values match the backend MasterType enum. */
export type MasterType = 'Vertical' | 'ContractSelectionMode' | 'ContractFor' | 'ContractCategory' | 'Department';

export interface MasterItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  // Contract-category only.
  defaultRetentionPercentage?: number | null;
  defaultDurationMonths?: number | null;
  showCostPaymentSection?: boolean | null;
}

// ---- Contracts -----------------------------------------------------------

export interface ContractListItem {
  id: string;
  contractNumber: string;
  title: string;
  vendorId: string;
  vendorName: string;
  departmentName?: string;
  categoryName?: string;
  status: string;
  contractValue: number;
  committedValue: number;
  disbursedValue: number;
  availableValue: number;
  startDate: string;
  endDate: string;
  versionNumber: number;
  daysToExpiry: number;
  workOrderCount: number;
  pendingWithUserId?: string;
  pendingWith?: string;
  createdOn: string;
}

// ---- Work orders ---------------------------------------------------------

export interface WorkOrderListItem {
  id: string;
  workOrderNumber: string;
  title: string;
  contractId?: string;
  contractNumber?: string;
  vendorId: string;
  vendorName: string;
  departmentName: string;
  status: string;
  totalAmount: number;
  invoicedAmount: number;
  paidAmount: number;
  billableBalance: number;
  issueDate: string;
  expectedCompletionDate: string;
  actualCompletionDate?: string;
  isMilestoneBased: boolean;
  paymentScheduleType: string;
  delayInDays: number;
  publishedOn?: string;
  invoiceCount: number;
  pendingWithUserId?: string;
  pendingWith?: string;
}

// ---- Invoices ------------------------------------------------------------

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  vendorInvoiceNumber: string;
  workOrderId: string;
  workOrderNumber: string;
  vendorId: string;
  vendorName: string;
  departmentName: string;
  invoiceType: string;
  /** The billing period this invoice covers, for a periodic work order. */
  billingPeriodLabel?: string;
  status: string;
  grossAmount: number;
  approvedDeductionAmount: number;
  netPayableAmount: number;
  paidAmount: number;
  vendorInvoiceDate: string;
  submittedOn?: string;
  dueDate?: string;
  ageInDays: number;
  pendingWithUserId?: string;
  pendingWith?: string;
}

export interface InvoiceReviewContext {
  contract?: {
    id: string;
    contractNumber: string;
    title: string;
    vendorName: string;
    gstin?: string;
    contractValue: number;
    committedValue: number;
    availableValue: number;
    status: string;
  } | null;
  workOrder?: {
    id: string;
    workOrderNumber: string;
    title: string;
    totalAmount: number;
    invoicedAmount: number;
    billableBalance: number;
    status: string;
    paymentScheduleType: string;
    startDate: string;
    expectedCompletionDate: string;
  } | null;
  slas: {
    /** 'Contract' or 'WorkOrder' — where the line came from. */
    source: string;
    sequenceNumber: number;
    metric: string;
    measurementPeriod: string;
    targetValue?: string;
    failureCondition?: string;
    deductionType: string;
    deductionValue: number;
    penaltyPeriod: string;
  }[];
  previousInvoices: {
    id: string;
    invoiceNumber: string;
    vendorInvoiceNumber: string;
    grossAmount: number;
    netPayableAmount: number;
    paidAmount: number;
    status: string;
    submittedOn?: string;
  }[];
  previouslyPaid: number;
  previouslyClaimed: number;
  /** True when the invoice's current approval step must capture the per-SLA compliance verdict. */
  capturesSlaComplianceAtCurrentStep: boolean;
}

export interface InvoiceDeduction {
  id: string;
  deductionType: string;
  description: string;
  percentage?: number;
  baseAmountForCalculation?: number;
  amount: number;
  isSystemGenerated: boolean;
  isRecommendation: boolean;
  isApproved: boolean;
  originalRecommendedAmount?: number;
  overrideReason?: string;
}

export interface InvoiceDetail extends InvoiceListItem {
  baseAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  contractId?: string;
  milestoneId?: string;
  milestoneName?: string;
  billingYear?: number;
  billingMonth?: number;
  recommendedDeductionAmount: number;
  technicalRemarks?: string;
  certifiedWorkPercentage?: number;
  financeOverrideReason?: string;
  financeRemarks?: string;
  vendorCode: string;
  deductions: InvoiceDeduction[];
  slaCompliances: InvoiceSlaCompliance[];
}

export interface InvoiceSlaCompliance {
  source: string;
  sequenceNumber: number;
  metric: string;
  complianceStatus: string;
  nonComplianceReason?: string;
  reviewedOn: string;
  reviewedByName?: string;
  reviewedByDesignation?: string;
}

export interface InvoicePayment {
  id: string;
  paymentNumber: string;
  adviceNumber?: string;
  status: string;
  paymentMode: string;
  amount: number;
  scheduledDate?: string;
  disbursedOn?: string;
  utrNumber?: string;
  referenceNumber?: string;
  instrumentDate?: string;
  bankName?: string;
  isManualEntry: boolean;
}

export interface RecordPaymentBody {
  amount: number;
  paymentMode: string;
  referenceNumber: string;
  instrumentDate?: string;
  bankName?: string;
  paymentDate: string;
  remarks?: string;
}

// ---- Payments ------------------------------------------------------------

export interface PaymentQueueItem {
  invoiceId: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  departmentName: string;
  grossAmount: number;
  approvedDeductionAmount: number;
  netPayableAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate?: string;
  ageInDays: number;
  isBankVerified: boolean;
  paymentAdviceId?: string;
  paymentStatus?: string;
}

// ---- NGPS Sanction Orders -----------------------------------------------

/** VPS-side lifecycle of an order pushed to NGPS. NGPS's own progress is ngpsResponseCode. */
export type NgpsSanctionOrderState = 'Pending' | 'Rejected' | 'Accepted' | 'Completed' | 'Cancelled';

export interface SanctionOrderSetup {
  isNgpsConfigured: boolean;
  isUserLinked: boolean;
  isSignatory: boolean;
  isTenantConfigured: boolean;
  portalId?: number;
  schemeId?: number;
  categoryId?: number;
  subCategoryId?: number;
  districtId?: number;
  demographyId?: number;
  maxBeneficiariesPerOrder: number;
  frequencyValue: number | null;
}

export interface SanctionCandidate {
  invoiceId: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  departmentName: string;
  paymentId?: string;
  paymentNumber?: string;
  paymentStatus?: string;
  amount: number;
  beneficiaryName: string;
  accountNumberMasked: string;
  ifsc: string;
  isReprocess: boolean;
  issues: string[];
}

export interface SanctionOrderPreviewRow {
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  portalReferenceNo: string;
  beneficiaryId: string;
  beneficiaryName: string;
  accountNumberMasked: string;
  ifsc: string;
  amount: number;
  address: string;
  willRaiseAdvice: boolean;
  issues: string[];
}

export interface SanctionOrderPreview {
  rows: SanctionOrderPreviewRow[];
  totalAmount: number;
  totalBeneficiaries: number;
  soType: number;
  frequencyValue: number;
  year: number;
  errors: string[];
  canSubmit: boolean;
}

export interface SanctionOrderSubmitResult {
  sanctionOrderId: string;
  sanctionOrderNo: number;
  state: NgpsSanctionOrderState;
  message: string;
  ngpsReferenceNo?: string;
  alreadyReceived: boolean;
  rowErrors: { portalReferenceNo: string; message: string }[];
}

export interface SanctionOrderSyncResult {
  state: NgpsSanctionOrderState;
  ngpsResponseCode?: number;
  ngpsStatusText?: string;
  paidNow: number;
  failedNow: number;
  message?: string;
}

export interface SanctionOrderListItem {
  id: string;
  sanctionOrderNo: number;
  description?: string;
  sanctionDate: string;
  soType: number;
  totalAmount: number;
  totalBeneficiaries: number;
  state: NgpsSanctionOrderState;
  ngpsResponseCode?: number;
  ngpsStatusText?: string;
  ngpsReferenceNo?: string;
  ngpsPaymentOrderId?: string;
  submittedByName?: string;
  submittedOn?: string;
  lastPolledOn?: string;
  paidCount: number;
  failedCount: number;
}

export interface SanctionOrderLine {
  id: string;
  lineNo: number;
  paymentId: string;
  paymentNumber: string;
  paymentStatus: string;
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  portalReferenceNo: string;
  beneficiaryName: string;
  accountNumberMasked: string;
  ifscCode: string;
  amount: number;
  validationMessage?: string;
  ngpsReferenceNo?: string;
  bankName?: string;
  bankTransactionNo?: string;
  paymentStatusId?: number;
  failureReason?: string;
  processDate?: string;
  resultAppliedOn?: string;
}

export interface SanctionOrderDetail {
  id: string;
  sanctionOrderNo: number;
  portalId: number;
  schemeId: number;
  description?: string;
  sanctionDate: string;
  frequencyValue: number;
  paymentYear: number;
  soType: number;
  totalAmount: number;
  totalBeneficiaries: number;
  state: NgpsSanctionOrderState;
  ngpsResponseCode?: number;
  ngpsStatusText?: string;
  ngpsRemarks?: string;
  ngpsReferenceNo?: string;
  ngpsPaymentOrderId?: string;
  ngpsSignerName?: string;
  ngpsSignedOn?: string;
  lastMessage?: string;
  submittedByName?: string;
  submittedOn?: string;
  lastPolledOn?: string;
  nextPollOn?: string;
  finalOn?: string;
  createdOn: string;
  lines: SanctionOrderLine[];
}

// ---- Rule admin ----------------------------------------------------------

export interface RuleSetSummary {
  id: string;
  code: string;
  name: string;
  description?: string;
  trigger: string;
  entityType: string;
  evaluationMode: string;
  departmentName?: string;
  isActive: boolean;
  priority: number;
  definitionVersion: number;
  ruleCount: number;
}

export interface RuleCondition {
  id?: string;
  isGroup: boolean;
  logicalOperator: string;
  factKey?: string;
  factDataType?: string;
  operator?: string;
  value?: string;
  valueTo?: string;
  isNegated: boolean;
  sortOrder: number;
  children: RuleCondition[];
}

export interface RuleAction {
  id?: string;
  actionType: string;
  parametersJson: string;
  description?: string;
  sortOrder: number;
}

export interface Rule {
  id: string;
  code: string;
  name: string;
  description?: string;
  priority: number;
  isActive: boolean;
  isDefaultRule: boolean;
  rootCondition?: RuleCondition;
  actions: RuleAction[];
}

export interface RuleSetDetail extends RuleSetSummary {
  rules: Rule[];
}

export interface RuleFact {
  factKey: string;
  displayName: string;
  description?: string;
  dataType: string;
  entityType: string;
  category?: string;
  allowedValues: string[];
  unit?: string;
}

export interface SimulateResult {
  actions: { actionType: string; parametersJson: string; sourceRuleCode: string }[];
  matchedRules: { code: string; name: string; description?: string }[];
  explanation: string[];
  approvalLevels?: number;
  approvalSlaHours?: number;
  contractRequired?: boolean;
  isBlocked: boolean;
  blockMessage?: string;
  isAutoApproved: boolean;
  isFlaggedForAudit: boolean;
}

export interface SetThresholdResult {
  conditionId: string;
  ruleSetId: string;
  ruleSetCode: string;
  factKey?: string;
  previousValue?: string;
  newValue: string;
  newDefinitionVersion: number;
}

// ---- Workflow admin ------------------------------------------------------

export interface WorkflowStep {
  id?: string;
  stepNumber: number;
  name: string;
  description?: string;
  mode: string;
  assignedRoleId?: string;
  assignedRoleName?: string;
  assignedUserId?: string;
  assignToDocumentDepartment: boolean;
  slaHours?: number;
  canReject: boolean;
  canReturn: boolean;
  requiresOtp: boolean;
  requiresDigitalSignature: boolean;
  isRemarksMandatory: boolean;
  /** When true, the officer at this step records the invoice's per-SLA compliance verdict. */
  capturesSlaCompliance: boolean;
  /** When true, the step clears itself on submission (the Creator's step 1). */
  autoCompleteOnRaise?: boolean;
}

export interface WorkflowDefinitionSummary {
  id: string;
  code: string;
  name: string;
  entityType: string;
  isDefault: boolean;
  isActive: boolean;
  definitionVersion: number;
  overallSlaHours?: number;
  stepCount: number;
}

export interface WorkflowDefinitionDetail extends WorkflowDefinitionSummary {
  description?: string;
  routingMode?: 'Auto' | 'Manual';
  securityDepositRequired?: boolean;
  securityDepositLevel?: string;
  securityDepositType?: string;
  securityDepositValue?: number;
  steps: WorkflowStep[];
}

// ---- Documents (attachments) ---------------------------------------------

export interface DocumentFile {
  id: string;
  ownerType: string;
  ownerId: string;
  originalFileName: string;
  contentType: string;
  fileSizeBytes: number;
  documentCategory?: string;
  description?: string;
  uploadedByName?: string;
  uploadedOn: string;
  isVerified: boolean;
}

// ---- Vendor change requests ----------------------------------------------

export type VendorChangeRequestType = 'Contact' | 'BankAccount';
export type VendorChangeRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface VendorChangeRequest {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  requestType: VendorChangeRequestType;
  status: VendorChangeRequestStatus;
  reason?: string;
  raisedByVendor: boolean;
  raisedByUser?: string;
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
  reviewedByUser?: string;
  reviewedOn?: string;
  reviewRemarks?: string;
  createdOn: string;
}

// ---- Workflow progress (approval trail) ----------------------------------

export interface WorkflowStepProgress {
  stepNumber: number;
  stepName: string;
  taskId?: string;
  assignedRole?: string;
  assignedToUser?: string;
  status: string;
  isCurrent: boolean;
  actionedBy?: string;
  actionedOn?: string;
  dueOn?: string;
  isOverdue: boolean;
  remarks?: string;
}

export interface WorkflowProgress {
  hasWorkflow: boolean;
  instanceId?: string;
  workflowName?: string;
  status: string;
  currentStepNumber?: number;
  totalSteps: number;
  initiatedBy?: string;
  startedOn?: string;
  completedOn?: string;
  summary: string;
  steps: WorkflowStepProgress[];
}

// ---- Contract / Work Order detail (subset used by the detail drawers) -----

export interface ContractDetail {
  id: string;
  contractNumber: string;
  title: string;
  description?: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  pendingWithUserId?: string;
  departmentId?: string;
  departmentName?: string;
  contractCategoryId?: string;
  categoryName?: string;
  verticalId?: string;
  verticalName?: string;
  contractSelectionModeId?: string;
  selectionModeName?: string;
  contractForId?: string;
  contractForName?: string;
  contractForOther?: string;
  status: string;
  contractValue: number;
  committedValue: number;
  disbursedValue: number;
  startDate: string;
  endDate: string;
  signedDate?: string;
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
  liquidatedDamagesCapPercentage?: number;
  penaltyGraceDays?: number;
  isRenewable: boolean;
  renewalPeriodMonths?: number;
  versionNumber: number;
  approvedOn?: string;
  rejectionReason?: string;
  remarks?: string;
  slas?: ContractSlaRow[];
}

export interface ContractSlaRow {
  sequenceNumber: number;
  metric: string;
  measurementPeriod: string;
  targetValue?: string;
  failureCondition?: string;
  deductionType: string;
  deductionValue: number;
  penaltyPeriod?: string;
  penaltyCapPercentage?: number | null;
  remarks?: string;
}

export interface WorkOrderDetail {
  id: string;
  workOrderNumber: string;
  title: string;
  description?: string;
  contractId?: string;
  contractNumber?: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  pendingWithUserId?: string;
  departmentId: string;
  departmentName: string;
  status: string;
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountType?: string;
  invoicedAmount: number;
  paidAmount: number;
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
  approvedOn?: string;
  rejectionReason?: string;
  remarks?: string;
  isMilestoneBased: boolean;
  paymentScheduleType: string;
  lineItems: WorkOrderLineItem[];
  milestones: WorkOrderMilestone[];
  slas: WorkOrderSla[];
}

export interface WorkOrderMilestone {
  id: string;
  sequenceNumber: number;
  name: string;
  description?: string;
  percentageOfTotal: number;
  amount: number;
  dueDate?: string;
  completedOn?: string;
  status: string;
  invoiceId?: string;
}

export interface WorkOrderSla {
  sequenceNumber: number;
  metric: string;
  measurementPeriod: string;
  targetValue?: string;
  failureCondition?: string;
  deductionType: string;
  deductionValue: number;
  penaltyPeriod?: string;
  remarks?: string;
}

export interface WorkOrderLineItem {
  itemDescription: string;
  hsnSacCode?: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  gstRate: number;
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
}

// ---- Approvals -----------------------------------------------------------

export interface ApprovalTask {
  taskId: string;
  entityType: string;
  entityId: string;
  entityReference?: string;
  title?: string;
  amount?: number;
  vendorId?: string;
  vendorName?: string;
  stepNumber: number;
  stepName: string;
  currentStepNumber?: number;
  totalSteps: number;
  routingMode: 'Auto' | 'Manual';
  isRemarksMandatory: boolean;
  canReject: boolean;
  canReturn: boolean;
  initiatedBy?: string;
  assignedToUserId?: string;
  assignedTo?: string;
  isMine: boolean;
  assignedOn: string;
  dueOn?: string;
  isOverdue: boolean;
  isEscalated: boolean;
}

export interface ActOnApprovalResult {
  taskId: string;
  action: string;
  isComplete: boolean;
  isApproved: boolean;
  isRejected: boolean;
  isReturned: boolean;
  currentStepNumber?: number;
  documentStatus: string;
  message: string;
}

// ---- Audit ---------------------------------------------------------------

export interface TimelineEvent {
  source: string;
  title: string;
  userName?: string;
  remarks?: string;
  tone: string;
  timestamp: string;
}

export interface EntityTimeline {
  entityName: string;
  entityId: string;
  entityReference?: string;
  events: TimelineEvent[];
}

export interface AuditEntry {
  id: string;
  action: number;
  actionLabel: string;
  entityName: string;
  entityReference?: string;
  userName?: string;
  actorDesignation?: string;
  actorRoles?: string;
  ipAddress?: string;
  remarks?: string;
  timestamp: string;
  changes: { field: string; oldValue?: string; newValue?: string }[];
}
