# Vendor Payment System (VPS) — Complete Functionality Document

**Owner:** National eGovernance Division (NeGD), Ministry of Electronics and Information Technology
**System type:** Multi-organisation, government procurement-to-payment platform
**Audience:** Vendors (suppliers) and government officials (procurement, technical, finance, payment, audit, administration)

This document describes the complete functionality of the platform — every module, workflow, role, rule, status, API endpoint, and data concept.

---

## 1. Purpose & Scope

VPS is a single, auditable platform that runs the full lifecycle of government vendor payments:

**Vendor onboarding → Contract → Work Order → Invoice → Multi-level review & approval → Deductions → Payment (advice, sanction, disbursement)**

Everything that decides *how* a document is routed — approval depth, thresholds, deductions, whether a contract is required — is **configured in a rule engine**, not hard-coded. Every approval is **multi-level and fully transparent** (you can always see where a document is pending and with whom). Every action is captured in an **append-only audit trail**.

The platform is **multi-organisation**: one deployment can be adopted by many departments, offices or ministries, each isolated from the others, with its own users, rules, approval routes, master data and brand theme.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Backend | .NET 10, C#, Clean Architecture, CQRS (MediatR) |
| Persistence | PostgreSQL, Dapper (hand-written SQL for reads, `IRepository<T>` for writes), Row-Level Security (RLS) |
| API | ASP.NET Core Web API, JWT auth, Swagger/OpenAPI, SignalR (real-time), Hangfire (background jobs) |
| Frontend | React 19 + TypeScript + Vite, MUI (Material UI) + Tailwind, Redux Toolkit, React Query, React Hook Form + Zod, Framer Motion, Recharts |
| Integrations | API Setu GSTN v2 (GST verification), SMTP / SMS / WhatsApp / In-app notifications, blob storage (Local / Azure Blob / S3 / MinIO) |

**Architecture layers:** `Domain ← Application ← Infrastructure ← API`, with a cross-cutting `Shared` project. Commands flow through MediatR pipeline behaviours: **Validation → Authorization → Transaction → Logging**.

---

## 3. User Roles

Twelve seeded roles, ordered by seniority (hierarchy level). Role **codes** are internal; **display names** are shown in the UI.

| Code | Display name | Responsibility |
|---|---|---|
| `SUPER_ADMIN` | Super Admin | NeGD platform operator; the only role that spans organisations |
| `TENANT_ADMIN` | **Organisation Admin** | Administers one organisation end to end (users, rules, workflows, everything) |
| `DEPARTMENT_ADMIN` | Department Admin | Administers a single department |
| `APPROVER` | Approver | Senior approving authority across document types |
| `FINANCE_OFFICER` | Finance Officer | Verifies invoices, settles deductions, reviews vendor bank changes |
| `PAYMENT_OFFICER` | Payment Officer | Approves and releases disbursements |
| `ACCOUNTS_OFFICER` | Accounts Officer | Maintains payment advices and accounting records |
| `CONTRACT_OFFICER` | Contract Officer | Drafts and manages contracts |
| `PURCHASE_OFFICER` | Purchase Officer | Raises and manages work orders |
| `TECHNICAL_OFFICER` | Technical Officer | Inspects work and recommends deductions |
| `AUDITOR` | Auditor | Read-only access across all records plus the audit trail |
| `VENDOR` | Vendor | Supplier portal access, restricted to their own records |

> Only **Organisation Admin** and **Super Admin** may create or edit rules and workflows. Other roles hold `rule.view` / `workflow.view` (read-only), or nothing, at the admin's discretion.

---

## 4. Permissions Model

Access is permission-based (not role-based directly); roles are bundles of permissions. Permissions are checked **server-side on every request** (the client only uses them to show/hide controls). Permissions by module:

- **dashboard**: `view`, `executive.view`
- **vendor**: `view`, `create`, `update`, `verify`, `blacklist`, `rate`, `delete`, `bankdetails.view`, `bankdetails.verify`
- **contract**: `view`, `create`, `update`, `submit`, `approve`, `amend`, `renew`, `sign`, `terminate`, `delete`, `export`
- **workorder**: `view`, `create`, `update`, `submit`, `approve`, `publish`, `sign`, `clone`, `cancel`, `delete`, `export`
- **invoice**: `view`, `create`, `submit`, `update`, `resubmit`, `technicalreview`, `financereview`, `approve`, `reject`, `delete`, `export`
- **inspection**: `view`, `create`, `update`
- **payment**: `view`, `queue.view`, `advice.create`, `advice.approve`, `approve`, `sanction`, `disburse`, `reverse`, `export`
- **rule**: `view`, `create`, `update`, `delete`, `simulate`, `executionlog.view`
- **workflow**: `view`, `create`, `update`, `delete`, `delegate`, `reassign`, `escalate`, `cancel`
- **document**: `view`, `upload`, `download`, `verify`, `delete`
- **report**: `view`, `financial.view`, `audit.view`, `export`
- **audit**: `view`, `export`
- **department**: `view`, `create`, `update`, `delete`
- **user**: `view`, `create`, `update`, `assignrole`, `resetpassword`, `delete`
- **role**: `view`, `create`, `update`, `permissions`, `delete`
- **master**: `view`, `manage`, `templates`, `numberseries`
- **tenant** *(internal — organisation management)*: `view`, `create`, `update`, `branding`, `switch`, `delete`

---

## 5. Functional Modules

### 5.1 Public Home / Landing Page (`/`)

Public, unauthenticated landing page. Contents:
- Sticky top bar with **Register** and **Login**.
- **Hero carousel** (auto-rotating) with four value-proposition slides.
- **Stats band** (GST-verified onboarding, rule-driven approvals, end-to-end transparency, append-only audit).
- **Modules carousel** walking through the six functional areas.
- **Features grid**, **How-it-works** (Register → Verify → Award → Pay), **Who it's for** (Vendors / Officers / Administrators), CTA, footer.
- A signed-in user hitting `/` is redirected to their dashboard.

### 5.2 Vendor Self-Registration (`/register`)

A public multi-step wizard (no login required):

1. **Choose organisation** — from the active organisations list (`GET /api/v1/public/organisations`).
2. **Email + mobile → OTP** — `POST /registration/start` issues an email OTP (in development the OTP is returned inline; in production it is emailed). Masked recipient shown.
3. **Verify OTP** — `POST /registration/verify-otp` returns a short-lived **registration token** (30-min, audience `vps.registration`).
4. **GSTIN fetch** — `POST /registration/gstin` (token-gated) fetches particulars from the GST network; **GST-sourced fields are shown read-only** (legal name, trade name, PAN, constitution, registered address, GST status).
5. **Bank details + contact person + password → complete** — `POST /registration/complete`. The server **re-fetches GST server-side** (never trusts the client copy), runs the `OnVendorRegistration` rule (blocks blacklisted PANs), guards duplicate GSTIN/email, and creates the **Vendor (PendingVerification)** + primary **bank account** + **portal login** in one transaction.

Result: the vendor can sign in immediately to track verification, but cannot be awarded work until an official verifies them.

### 5.3 Authentication

- **Login** (`POST /api/v1/auth/login`): organisation code + username/email + password → JWT access token + refresh token + user profile (roles, permissions, organisation branding).
- **OTP service**: PBKDF2-hashed OTPs with purposes — Login, ForgotPassword, EmailVerification, MobileVerification, PaymentApproval.
- **Tokens**: access tokens + registration tokens (distinct audiences). Refresh flow with a single in-flight refresh shared across parallel 401s.
- **Passwords**: PBKDF2 (210k iterations), salted.
- **Session** rehydrates from local storage across refreshes.

### 5.4 Vendor Management (`/vendors`)

- **List** (`GET /vendors`) — filter by status, category, MSME, state, verified flag; paged; searchable. A vendor-portal account sees only its own record.
- **Detail drawer** (`GET /vendors/{id}`) — identity, GSTIN/PAN, contact, address, bank accounts (masked unless `vendor.bankdetails.view`), verification flags, rating, standing.
- **GST lookup** (`GET /vendors/gstin/{gstin}`) — authenticated GSTIN lookup for onboarding.
- **Register (office-side)** (`POST /vendors`) — an official registers a vendor; GSTIN validated and its embedded PAN cross-checked; enters `PendingVerification`.
- **Verify** (`POST /vendors/{id}/verify`) — approve or **reject** (rejection remarks mandatory). GST and PAN must both be confirmed to activate. Approve → `Active`; reject → `Rejected`.
- **Blacklist / reinstate** (`POST /vendors/{id}/blacklist`) — bars further award (existing commitments untouched); reason mandatory; optional end date. Reports open work orders / unpaid invoices / outstanding amount. Reinstatement returns the vendor to `Active`.
- **Ratings** — vendors carry a performance rating.

**Vendor statuses:** Draft → PendingVerification → Active → (Suspended / Blacklisted) / Rejected.

### 5.5 Vendor Detail Change Requests (`/vendor-changes`)

Contact and — critically — **bank-account** particulars are never edited in place. A change is **requested** and takes effect only on approval.

- **Raise** (`POST /vendors/change-requests`) — by the vendor (own record only) or an official on their behalf. Two types: **Contact** (person/mobile/alt-phone/email) or **BankAccount** (holder/number/IFSC/bank/branch/type). One open request per type per vendor.
- **List** (`GET /vendors/change-requests`) — a vendor sees only their own; officials see the review queue (filter by status).
- **Review** (`POST /vendors/change-requests/{id}/review`) — approve or reject (rejection reason mandatory). On approve the values are copied onto the live record.
  - **Segregation of duties:** the raiser cannot approve their own request.
  - **Authority by type:** a contact change needs `vendor.update`; a **bank change needs `vendor.bankdetails.verify`** (held by Finance and Admin).
  - **Bank safety:** an approved bank change **resets verification** (`isVerified` / `isBankVerified` → false) — the new account must be re-verified before payments resume.

### 5.6 Contracts (`/contracts`)

A government-format legal agreement that work orders draw against. Amendments create a **new version** (same root, incremented version) — the superseded text and its approval record are preserved.

**Create form sections (government legal format):**
1. **Parties & Purpose** — title/purpose, vendor (supplier), department (government office), category.
2. **Scope of Work** — goods, services, deliverables, performance rules.
3. **Cost & Payment** — total contract value, retention %, security deposit, payment terms.
4. **Term & Termination** — start/end dates, renewable flag, general conditions (incl. early-termination).
5. **Standard Legal Clauses** — **Compliance**, **Indemnification**, **Dispute Resolution** (each a distinct stored field).

- **Create** (`POST /contracts`) — drafts a contract (editable, no approval started). Optional template pre-fills scope/terms/payment.
- **Detail drawer** (`GET /contracts/{id}`) — full particulars, vendor & contact, **approval progress** (see §5.8), **attachments** (see §5.13), scope, and all terms/legal clauses; plus amendment history.
- **Submit** (`POST /contracts/{id}/submit`) — the rule engine decides approval depth from value/category/department; a **plain-language explanation** of which rule applied is returned. A rule may auto-approve low-value contracts.
- **Amend** (`POST /contracts/{id}/amend`) — raises a new version; fields left null are carried forward; the new version clears approval on its own merits.

**Contract statuses:** Draft → PendingApproval → Approved → Active → (Suspended / Expired / Terminated) / Rejected / Cancelled.

### 5.7 Work Orders (`/work-orders`)

Raised against approved contracts, laid out in the **standard public-sector work-order format**. Prepared by NeGD officials only (`workorder.create`).

**Create form sections:**
1. **Header & Agency Information** — issuing department/agency, WO number (auto-generated), issue date (on approval), reference contract.
2. **Vendor Information** — vendor selection; auto-filled GSTIN, PAN, authorised contact (mobile), registered location; editable service-site/delivery location.
3. **Scope of Work & Deliverables** — project title, task description, timeline (start/completion), and **deliverable line items** (description, HSN/SAC, qty, unit, unit price, GST rate).
4. **Financial & Payment Terms** — computed base/tax/total; billing & statutory-deduction note (TDS, GST withholding).
5. **Authorisation** — prepared-by (the official) + note that approval is via the rule-decided workflow; the vendor accepts on publication.

- **Create** (`POST /work-orders`) — line-item **tax is computed server-side** (not accepted from the client); GST rate must be a legal slab (0, 0.25, 3, 5, 12, 18, 28%). Whether a **contract must be cited** is a rule decision at the resulting value (the concept note's "> ₹1 lakh requires a contract" is configuration). If a contract is cited, its **available balance** must cover the order and the vendor must match; the milestone schedule may be auto-generated by rule.
- **Contract dropdown** — shows the vendor's **Approved/Active** contracts with **available balance**; pending contracts appear disabled ("approve first"); a warning fires if the order exceeds the cited contract's balance.
- **Detail drawer** (`GET /work-orders/{id}`) — particulars, vendor & contact, approval progress, attachments, line items.
- **Submit** (`POST /work-orders/{id}/submit`) — rule engine sets approval depth and per-step SLA; may flag for audit.
- **Publish** (`POST /work-orders/{id}/publish`) — releases an approved order to the vendor (visible in the portal, available to invoice against); vendor notified by email, SMS and in-app push.

**Work Order statuses:** Draft → PendingApproval → Approved → Published → InProgress → Completed; plus Rejected / Cancelled / OnHold.

### 5.8 Approvals Inbox & Multi-level Workflow Transparency (`/approvals`)

Every officer has a personal **approvals inbox** — the tasks they must act on to move documents through their rule-decided levels.

- **My approvals** (`GET /api/v1/approvals`) — pending tasks assigned to the caller across all document types, with document type, reference, title, amount, step name, **level X of Y**, initiator, assigned/due dates, overdue and escalated flags. Ownership is the gate (you can't see another user's queue).
- **Act** (`POST /api/v1/approvals/{taskId}/act`) — **Approve / Reject / Return** with remarks (mandatory on reject/return).
  - Approve at the final level completes the chain; an earlier approval opens the next level.
  - **Contract/Work Order** outcomes are applied to the document: fully approved → `Approved`; rejected → `Rejected`; returned → `Draft` (re-editable).
  - Invoice/Payment tasks are actioned from their own dedicated screens (they carry deduction/disbursement semantics), so the inbox routes there.
  - The workflow engine enforces ownership, task state, and per-step mandatory-remarks.

**Workflow progress / transparency** (`GET /api/v1/config/workflows/progress/{entityType}/{entityId}`) — the live approval trail for any document, surfaced in the contract/work-order/invoice detail drawers. For each level it shows: status (NotStarted / Pending / Approved / Rejected / Returned), **who it is pending with**, who acted, remarks, due/overdue. A one-line summary reads e.g. *"Pending at level 2 — Financial Concurrence with Smt. Leela Krishnan."* Visible to anyone who can open the document.

### 5.9 Invoices (`/invoices`)

Vendors bill against **published work orders**. Supports **Full, Partial, Milestone, Advance, FinalSettlement** invoice types.

- **Submit** (`POST /invoices`) — line-item tax computed server-side; the claim is checked against the work order's remaining billable balance; duplicate vendor-invoice-number guarded; the rule engine sets approval depth; the invoice enters technical review.
- **Detail drawer** (`GET /invoices/{id}`) with tabs:
  - **Approval** (default) — the multi-level workflow progress (where pending, with whom, the full trail).
  - **Deductions** — the technical recommendation vs. the finance-settled figures; per-deduction breakdown.
  - **Details** — vendor invoice #, dates, department, base/CGST/SGST/IGST/total tax, paid, technical & finance remarks.
  - **Timeline** — the document's audit timeline.
- **Technical review** (`POST /invoices/{id}/technical-review`) — the officer certifies the % of work done and **recommends** a deduction; they cannot settle it. Recorded on the invoice and as an inspection report; preserved even if finance later overrides.
- **Finance review / settlement** (`POST /invoices/{id}/finance-review`) — the **override authority**. The rule engine computes statutory and contractual deductions (TDS, GST-TDS, retention, delay penalty, certified shortfall); the officer accepts or supplies their own figures. Where the settled total departs from the technical recommendation, an **override reason is mandatory**. Result: gross, approved deduction, net payable, and whether the recommendation was overridden.
- **Reverted invoices** — an invoice sent back for correction carries `Resubmitted` handling; the vendor edits and resubmits.

**Invoice statuses:** Draft → Submitted → UnderTechnicalReview → TechnicalApproved → UnderFinanceReview → FinanceApproved → PendingPayment → PartiallyPaid → Paid; plus Rejected / Resubmitted / Cancelled / OnHold.

**Deduction types:** TDS, GST-TDS, Retention Money, Security Deposit, Liquidated Damages, Penalty, Advance Adjustment, Quality Shortfall, SLA Breach, Other.

### 5.10 Payments (`/finance/queue`, `/payments`)

- **Payment queue** (`GET /payments/queue`) — invoices cleared for payment, paged/filtered.
- **Create payment advice** (`POST /payments/advice`) — assembles an advice from settled invoices.
- **Approve** (`POST /payments/{id}/approve`) — sanction/approval of a payment.
- **Disburse** (`POST /payments/{id}/disburse`) — releases the disbursement.
- **Detail** (`GET /payments/{id}`).

**Payment statuses:** Queued → PendingApproval → Approved → Processing → Disbursed; plus Failed / Reversed / Cancelled / OnHold.
**Payment modes:** NEFT, RTGS, IMPS, UPI, NACH, Cheque, Demand Draft, PFMS.

### 5.11 Rule Engine (`/config/rules`)

The heart of the configurability requirement — approval depth, thresholds, deductions and routing are **authored, not coded**. Admin-only for editing.

**Concepts:**
- **Rule set** — a named collection of rules bound to a **trigger** and an **entity type**, with an **evaluation mode** (FirstMatch — needs a default/else rule; or AllMatches — accumulates), priority and active flag.
- **Rule** — a condition tree plus the **actions** it emits. A default (else) rule always matches.
- **Condition** — a leaf (a **fact** compared to a value via an **operator**) or a group (AND/OR of children). Facts come from a catalogue (`GET /config/rules/facts`) so an admin authors without knowing column names.
- **Action** — what a matched rule does, with JSON parameters.

**Triggers:** OnVendorRegistration, OnContractCreate, OnContractSubmit, OnWorkOrderCreate, OnWorkOrderSubmit, OnInvoiceSubmit, OnTechnicalReview, OnFinanceReview, OnPaymentQueue, OnPaymentApproval, OnApprovalOverdue, OnScheduledReminder.

**Comparison operators:** Equals, NotEquals, GreaterThan, GreaterThanOrEqual, LessThan, LessThanOrEqual, Between, In, NotIn, Contains, NotContains, StartsWith, EndsWith, IsNull, IsNotNull, IsTrue, IsFalse.

**Action types:** SetApprovalLevels, SetWorkflow, RequireContract, RequireDocument, ApplyDeduction, ApplyPenalty, SetApprovalSla, SetEscalation, SetReminder, SendEmail.

**Operations:**
- **List / view** (`GET /config/rules/sets`, `GET /config/rules/sets/{id}`), **facts catalogue** (`GET /config/rules/facts`).
- **Create / replace** (`PUT /config/rules/sets`) — the editor builds the whole graph and posts it back; the definition version bumps on every save. **Create new** and **Edit existing** (pre-fills the editor; code locked) rule sets from the UI.
- **Change one threshold** (`POST /config/rules/conditions/{id}/threshold`) — the focused "raise ₹1 lakh to ₹2 lakh" operation; audited, version-bumped, effective on the next document.
- **Enable / disable** (`POST /config/rules/sets/{id}/active`).
- **Simulate** (`POST /config/rules/sets/{id}/simulate`) — dry-run against supplied facts; shows what it would decide (levels, contract-required, flagged-for-audit, matched rules) and a plain-language explanation; writes no log.
- **Execution log** (`GET /config/rules/execution-log`) — the evidence behind every rule-driven decision, with facts, matched rules and actions as they stood.

### 5.12 Workflow Administration (`/config/workflows`)

Dynamic approval routes the workflow engine runs. Admin-only for editing. Editing a route never disturbs approvals already in flight — running instances **pin the version** they started under.

- **List / view** (`GET /config/workflows`, `GET /config/workflows/{id}`).
- **Create / replace** (`PUT /config/workflows`) — a definition + ordered steps; version bumps on save. **Create new** and **Edit existing** (pre-fills; code locked) from the UI.
- **Progress** (`GET /config/workflows/progress/{entityType}/{entityId}`) — see §5.8.

**Step configuration:** step number & name, **mode** (Sequential / Parallel / Conditional), parallel-completion policy (Any / All / Majority), assignment (a **role**, a specific user, or the **document's department**), optional condition (fact/operator/value for conditional steps), **SLA hours**, reminder-before-hours, **escalation** role + after-hours + auto-escalate, and step flags: can-reject, can-return, can-delegate, **remarks-mandatory**, **requires-OTP**, **requires-digital-signature**.

### 5.13 Documents / Attachments

Files attached to any entity (contract, work order, invoice, vendor), stored in blob storage; visible to reviewers along the workflow.

- **List** (`GET /api/v1/documents?ownerType=&ownerId=`) — latest version of each attachment, with name, size, category, description, uploader, date, verified flag.
- **Upload** (`POST /api/v1/documents`, multipart) — PDF, image, Office and text files up to **25 MB**; content-type resolved from the file (falls back to extension); SHA-256 hash stored; requires `document.upload`.
- **Download** (`GET /api/v1/documents/{id}/download`) — streams the file with the bearer token; requires `document.download`.
- **UI** — an **Attachments** panel in the contract and work-order detail drawers (upload + list + download), visible to every approval officer.

### 5.14 Dashboard (`/dashboard`)

Role-aware landing screen: KPI cards (pending contracts / work orders / invoices, my approvals, today's payments, FY disbursed, in payment queue, total vendors), a monthly disbursement chart, invoice-status breakdown, **My Pending Approvals** (links into the approvals inbox), and recent activity from the audit trail. Vendor users see only their own document activity.

### 5.15 Reports

- **Payment summary** (`GET /api/v1/reports/payment-summary`).
- **Ageing** (`GET /api/v1/reports/ageing`) — outstanding by age bucket.
- **Tax deduction** (`GET /api/v1/reports/tax-deduction`) — TDS/GST-TDS statements.

### 5.16 Audit Trail (`/audit`)

- **List** (`GET /api/v1/audit`) — every recorded action, paged/filtered.
- **Entity timeline** (`GET /api/v1/audit/timeline/{entityName}/{entityId}`) — the chronological history of one document.
- **Append-only:** update/delete on the audit table is revoked even from the application role.

**Audit actions:** Create, Update, Delete, Read, Login, LoginFailed, Logout, Approve, Reject, Submit, Cancel, Export, Download, Upload, ConfigurationChange, PermissionChange, Disburse.

### 5.17 Lookups (`GET /api/v1/lookups`)

Reference data for forms: departments, vendor categories, contract categories, roles.

### 5.18 Notifications

Queue-based, multi-channel: **Email (SMTP), SMS, WhatsApp, Push, In-app.** Templates drive messages (e.g. VENDOR_REGISTERED, VENDOR_VERIFIED, VENDOR_CHANGE_APPROVED/REJECTED, APPROVAL_APPROVED/REJECTED/RETURNED/ADVANCED). Statuses: Queued → Sent / Failed → Read.

---

## 6. Multi-Organisation Model

- One deployment serves many organisations (departments / offices / ministries). Users, roles, rules, workflows, master data and documents are **tenant-scoped**.
- **Row-Level Security (RLS)** enforces isolation in the database against a least-privilege application role (`vps_app`, no BYPASSRLS). Session variables `vps.tenant_id` and `vps.is_platform_admin` are set per request; policies compare against them and fail closed (an anonymous/unknown context sees nothing).
- **Bootstrapping** operations that occur before a tenant context exists (sign-in, public self-registration) use SECURITY DEFINER functions / a public-tenant scope that binds the organisation and re-applies the RLS session.
- Each organisation supplies a **brand colour**; the whole console re-skins to it at sign-in.
- The **Super Admin** role is the only one that spans organisations.

> "Tenant" is the internal term for an organisation; the UI always says **Organisation**.

---

## 7. GST Integration

- Provider: **API Setu — GSTN v2** (`GET /gstn/v2/taxpayers/{gstin}`), headers `X-APISETU-CLIENTID` / `X-APISETU-APIKEY`.
- Returns legal name, trade name, PAN (derived), constitution, principal address, registration date, status.
- Used in **self-registration** (token-gated public lookup) and **office onboarding** (authenticated lookup). On completion the server **re-fetches server-side** and trusts its own copy — a tampered client form cannot register a vendor under a mismatched name/PAN.
- Not-found/errors fall back gracefully to manual entry.
- The API key lives only in developer secrets (`appsettings.Development.json`) / a production secret store — never in committed config.

---

## 8. Rule Catalogue (seeded)

| Rule set | Trigger / entity | What it decides |
|---|---|---|
| `WO_CONTRACT_MANDATORY` | Work Order | Whether a work order must cite an approved contract (the "> ₹1 lakh" threshold) |
| `WO_APPROVAL_LEVELS` | Work Order | Approval depth by value (high / medium / low) |
| `WO_MILESTONE_SCHEDULE` | Work Order | Staged vs single milestone billing |
| `CONTRACT_APPROVAL_LEVELS` | Contract | Approval depth by value (high / low) |
| `INVOICE_APPROVAL_LEVELS` | Invoice | Approval depth (high / standard) |
| `INVOICE_DEDUCTIONS` | Invoice | Statutory & contractual deductions (TDS, etc.) and penalties |
| `PAYMENT_APPROVAL` | Payment | Payment approval depth |
| `VENDOR_ONBOARDING` | Vendor registration | Registration gate — blocks blacklisted PANs |

All are editable/simulatable by an admin without redeployment.

---

## 9. Workflow Catalogue (seeded)

**`WF_CONTRACT` — contract approval (up to 5 levels):**

| Level | Step | Role |
|---|---|---|
| 1 | Scrutiny | Contract Officer |
| 2 | Financial Concurrence | Finance Officer |
| 3 | Competent Authority | Approver |
| 4 | Administrative Approval | Organisation Admin |
| 5 | Final Sanction | Approver |

**`WF_WORKORDER` — work-order approval (up to 5 levels):**

| Level | Step | Role |
|---|---|---|
| 1 | Verification | Purchase Officer |
| 2 | Technical Concurrence | Technical Officer |
| 3 | Budget Availability | Finance Officer |
| 4 | Competent Authority | Approver |
| 5 | Final Approval | Organisation Admin |

The **number of levels actually run** is decided by the rule engine from the document's value (e.g. a ₹50 lakh contract runs all 5; a smaller one runs fewer). Invoices route through technical certification → finance settlement → any further rule-decided levels.

---

## 10. State Machines (all statuses)

- **Vendor:** Draft, PendingVerification, Active, Suspended, Blacklisted, Rejected.
- **Contract:** Draft, PendingApproval, Approved, Active, Suspended, Expired, Terminated, Rejected, Cancelled.
- **Work Order:** Draft, PendingApproval, Approved, Published, InProgress, Completed, Rejected, Cancelled, OnHold.
- **Invoice:** Draft, Submitted, UnderTechnicalReview, TechnicalApproved, UnderFinanceReview, FinanceApproved, PendingPayment, PartiallyPaid, Paid, Rejected, Resubmitted, Cancelled, OnHold.
- **Payment:** Queued, PendingApproval, Approved, Processing, Disbursed, Failed, Reversed, Cancelled, OnHold.
- **Milestone:** Pending, InProgress, Completed, Invoiced, Paid, Cancelled.
- **Workflow instance:** NotStarted, InProgress, Approved, Rejected, Cancelled, Escalated.
- **Workflow task:** Pending, Approved, Rejected, Skipped, Delegated, Reassigned, Escalated, Cancelled, ReturnedForClarification.
- **Vendor change request:** Pending, Approved, Rejected, Cancelled.
- **User:** PendingEmailVerification, Active, Locked, Suspended, Inactive.
- **Notification:** Queued, Sent, Failed, Read.

---

## 11. Complete API Reference

Base: `/api/v1`. All except the public and auth routes require a bearer token; permissions are enforced per action.

**Public (anonymous)** — `/public`
- `GET  /public/organisations`
- `POST /public/registration/start`
- `POST /public/registration/verify-otp`
- `POST /public/registration/gstin`
- `POST /public/registration/complete`

**Auth**
- `POST /auth/login`

**Vendors** — `/vendors`
- `GET  /vendors` · `GET /vendors/{id}` · `GET /vendors/gstin/{gstin}`
- `POST /vendors` · `POST /vendors/{id}/verify` · `POST /vendors/{id}/blacklist`

**Vendor change requests** — `/vendors/change-requests`
- `GET  /vendors/change-requests` · `POST /vendors/change-requests` · `POST /vendors/change-requests/{id}/review`

**Contracts** — `/contracts`
- `GET  /contracts` · `GET /contracts/{id}`
- `POST /contracts` · `POST /contracts/{id}/submit` · `POST /contracts/{id}/amend`

**Work Orders** — `/work-orders`
- `GET  /work-orders` · `GET /work-orders/{id}`
- `POST /work-orders` · `POST /work-orders/{id}/submit` · `POST /work-orders/{id}/publish`

**Invoices** — `/invoices`
- `GET  /invoices` · `GET /invoices/{id}`
- `POST /invoices` · `POST /invoices/{id}/technical-review` · `POST /invoices/{id}/finance-review`

**Approvals** — `/approvals`
- `GET  /approvals` · `POST /approvals/{taskId}/act`

**Payments** — `/payments`
- `GET  /payments/queue` · `GET /payments/{id}`
- `POST /payments/advice` · `POST /payments/{id}/approve` · `POST /payments/{id}/disburse`

**Documents** — `/documents`
- `GET  /documents?ownerType=&ownerId=` · `POST /documents` (multipart) · `GET /documents/{id}/download`

**Rule engine** — `/config/rules`
- `GET  /config/rules/sets` · `GET /config/rules/sets/{id}` · `GET /config/rules/facts`
- `PUT  /config/rules/sets`
- `POST /config/rules/conditions/{conditionId}/threshold`
- `POST /config/rules/sets/{id}/active` · `POST /config/rules/sets/{id}/simulate`
- `GET  /config/rules/execution-log`

**Workflow admin** — `/config/workflows`
- `GET  /config/workflows` · `GET /config/workflows/{id}` · `GET /config/workflows/progress/{entityType}/{entityId}`
- `PUT  /config/workflows`

**Dashboard / Reports / Audit / Lookups**
- `GET  /dashboard`
- `GET  /reports/payment-summary` · `GET /reports/ageing` · `GET /reports/tax-deduction`
- `GET  /audit` · `GET /audit/timeline/{entityName}/{entityId}`
- `GET  /lookups`

---

## 12. Data Model (entities)

Platform/identity: **Tenant** (organisation), **Department**, **User**, **Role**, **Permission**, **RolePermission**, **UserRole**, **RefreshToken**, **OtpRequest**, **MenuItem**, **SavedSearch**, **NumberSeries**.

Vendor: **Vendor**, **VendorCategory**, **VendorBankAccount**, **VendorRating**, **VendorChangeRequest**.

Procurement: **Contract**, **ContractCategory**, **ContractTemplate**, **WorkOrder**, **WorkOrderLineItem**, **WorkOrderMilestone**.

Finance: **Invoice**, **InvoiceLineItem**, **InvoiceDeduction**, **InspectionReport**, **Payment**, **PaymentAdvice**.

Rule engine: **RuleSet**, **Rule**, **RuleCondition**, **RuleAction**, **RuleFactDefinition**, **RuleExecutionLog**.

Workflow: **WorkflowDefinition**, **WorkflowStep**, **WorkflowInstance**, **WorkflowTask**.

Cross-cutting: **StoredDocument**, **Notification**, **NotificationTemplate**, **AuditTrail**.

Every tenant-owned entity carries `tenant_id`, an audit block (`created_by/on`, `modified_by/on`, `ip_address`, `machine_name`), a soft-delete flag and an optimistic-concurrency `version`.

---

## 13. Security

- **Row-Level Security** on every tenant table; the app connects as least-privilege `vps_app` (never the schema owner), so isolation holds even if a query forgets its `WHERE`.
- **JWT** access + refresh tokens; distinct registration token; PBKDF2 password hashing (210k iterations).
- **OTP** for registration/verification/high-value approval; attempt-limited and expiring; wrong/expired/used are indistinguishable to the caller.
- **Segregation of duties** — the raiser of a vendor change request cannot approve it; technical review recommends but cannot settle; finance settles with mandatory override reasons; approvers act only on tasks assigned to them.
- **Append-only audit trail** — update/delete revoked from the app role; documents' status changes and approvals all recorded.
- **Server-side computation** of tax and deductions (never trusted from the client); GST re-fetched server-side on registration.
- **Sensitive-field protection** — bank account numbers masked unless `vendor.bankdetails.view`; a bank change requires two-person approval and resets verification.

---

## 14. Database & Migrations

Applied in filename order:

| Script | Contents |
|---|---|
| V001 | Extensions, schema, conventions |
| V002 | Platform identity (tenant, department, user, role, permission, menu) |
| V003 | Vendor (vendor, category, bank account, rating) |
| V004 | Procurement (contract, template, category, work order, line items, milestones) |
| V005 | Invoice & finance (invoice, line items, deductions, inspection) |
| V006 | Payment (payment, payment advice) |
| V007 | Rule engine (rule set, rule, condition, action, fact definition, execution log) |
| V008 | Workflow engine (definition, step, instance, task) |
| V009 | Documents, notifications, masters (stored_document, notification, templates, number series) |
| V010 | Audit trail |
| V011 | Indexes |
| V012 | Row-level security & grants |
| V013 | Authentication functions (SECURITY DEFINER sign-in) |
| V014 | Public registration (`public_active_tenants()` etc.) |
| V015 | Vendor change requests |
| V016 | Contract legal clauses (compliance / indemnification / dispute resolution) |
| V020 | Seed — permissions |
| V021 | Seed — organisations, roles, role-permissions, users |
| V022 | Seed — masters (departments, categories) |
| V023 | Seed — rule sets |
| V024 | Seed — workflows |

---

## 15. Setup & Run

**Backend:** `dotnet build VPS.slnx`, then run `VPS.API`.
**Frontend:** `cd frontend && npm install && npm run dev` (Vite proxies `/api` and `/hubs` to the backend).
**Database:** provision PostgreSQL, create the `vps` database, apply every script in `database/scripts/` in filename order, and set the `vps_app` password to match `appsettings.Development.json`. The API connects as `vps_app` (never the owner) so RLS is enforced.
**Backups:** `pg_dump -F c` to `database/` (git-ignored `*.backup`).

---

## 16. Demo Accounts (development)

The login page (development builds only) lists all seeded NeGD accounts — click to fill. All share the password **`Vps@2026#Demo`**. Vendors sign in with their registered email.

| Login | Role |
|---|---|
| `negd.superadmin` | Super Admin |
| `negd.admin` | Organisation Admin |
| `negd.approver` | Approver |
| `negd.finance` | Finance Officer |
| `negd.payment` | Payment Officer |
| `negd.accounts` | Accounts Officer |
| `negd.contract` | Contract Officer |
| `negd.purchase` | Purchase Officer |
| `negd.technical` | Technical Officer |
| `negd.auditor` | Auditor |

A second organisation (Ministry of Ports, Shipping & Waterways — `mopsw`) is also seeded to demonstrate multi-organisation isolation.

---

## 17. End-to-End Flow (worked example)

1. **Vendor registers** (`/register`): organisation → email OTP → GSTIN fetch (read-only particulars) → bank details + password → **PendingVerification**.
2. **Official verifies** the vendor (`/vendors` → verify) → **Active** (GST & PAN confirmed).
3. **Contract Officer drafts a contract** (legal sections + attaches the signed PDF) and **submits**; the rule engine sets, say, 5 levels. It clears **Scrutiny → Financial Concurrence → Competent Authority → Administrative Approval → Final Sanction** via each officer's **Approvals** inbox → **Approved**.
4. **Purchase Officer raises a work order** against that approved contract (deliverables + tax computed) and submits; it clears its rule-decided levels → **Approved** → **Published** to the vendor.
5. **Vendor invoices** against the published work order.
6. **Technical Officer certifies** work done and recommends a deduction; **Finance Officer settles** (TDS/retention/penalty) with an override reason if it departs from the recommendation → **FinanceApproved**.
7. **Payment** advice is created, **approved/sanctioned** and **disbursed**.
8. Throughout, anyone can open a document to see **exactly where it is pending and with whom**, and every action is in the **audit trail**.
