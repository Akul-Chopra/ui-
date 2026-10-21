# Gap Analysis — Current VPS vs. Proposed VPMS (MP / MPSeDC)

**Reference:** "Invoice Approval.pdf" — a step-by-step walkthrough (with screenshots) of the
**Vendor Bhugtan Prabandhan Pranali (वेंडर भुगतान प्रबंधन प्रणाली)** operated by **MPSeDC**
(Madhya Pradesh State Electronics Development Corporation), delivered as a module inside the
**MP e-SEVA / MP eGov single-sign-on portal**.

**Under review:** the current **VPS** codebase in this repository (NeGD Vendor Payment System —
.NET 10 Clean Architecture + React 19 + PostgreSQL, multi-organisation).

> Purpose: identify what the proposed VPMS does that the current VPS does **not** (gaps to close),
> and — for balance — where the current VPS already goes **beyond** the proposal.

---

## 1. The proposed system at a glance (from the PDF)

**Platform.** VPMS is one module (“VPMS (MPSedc)”, alongside “VPMS (Mining)”) inside the **MP e-SEVA**
portal — a state-wide eGov SSO with a live session timer. Users pick a role with a **“Select Role”**
switcher (one login, multiple roles).

**Roles & fixed flow.**

| Role | Does |
|---|---|
| **PO** (Procurement Officer) | Creates **Contract + Vendor**; first-line invoice check; **Forward to concerned OIC / Revert to Vendor / Reject**; can select **multiple invoices** at once |
| **Vendor** | Raises invoices against an **Active Contract → Work Order** |
| **OIC** (Officer-in-Charge) | **Verify / Not Verify** with comment; reviews supporting docs, Penalty/SLA (TPA reports), Stocks/Goods payment; then **e-Signs** |
| **FO** (Finance Officer) | Final invoice verification |

**Invoice lifecycle:** Vendor raises → **PO** forwards → **OIC** verifies + **e-signs** → back to **PO** →
**FO** final verify. Each invoice shows a **“Pending At Role”** column and role-routed statuses
(“Invoice forwarded by Vendor to PO”, “Forwarded to PO by OIC (Verified)”).

**Signing (the headline feature).** OIC/officers **digitally sign** each invoice through the
**C-DAC “Hastākshar” eSign ASP gateway** at `esign.mp.gov.in`, using **Aadhaar e-KYC** (Aadhaar No /
Virtual ID / UID Token) with **OTP**, or a **DSC** — producing a legally-valid IT-Act digital signature.

**Government integration.** Every invoice carries an **e-File No / Computer No** and a **Ref-No**,
i.e. it is tied into the government **e-Office / e-File** system.

**Commercial constructs.** Contracts carry **Agency Selection Mode** (Tender / Quotation / Nomination),
**Tender/Quotation/Nomination No**, **Contract Signing Date**, **Tender Platform/Mode**; work orders
carry a **Service Charge** (applicable Y/N, type = percentage, e.g. 20%). Invoices are keyed by
**Financial Year + Month**, **Payment Schedule (Monthly)** and **Project**.

**Cross-cutting.** Every list has **Export to Excel**; there are dedicated **Reports** and
**Downloads** modules; dashboards show Total / Pending / Paid invoice counts and Gross Amount
(Pending / Paid) in Lakh.

---

## 2. Role & flow — side by side

| | Proposed VPMS (MP) | Current VPS |
|---|---|---|
| **Roles in the invoice chain** | PO → OIC → FO (fixed) | Technical Officer → Finance Officer → Accounts Officer (+ Approver, Payment Officer) — **configurable** |
| **Routing** | Hard-coded PO→OIC→FO | **Rule Engine + Workflow Engine** decide levels/roles by value, department, conditions |
| **Vendor onboarding** | PO creates the vendor | **Vendor self-registration** (public OTP + GST) then internal verification |
| **Invoice raised against** | Active Contract → Work Order | Work Order (contract optional/mandatory by rule) |
| **Officer decision verbs** | Forward / Revert / Reject; Verify / Not Verify | Approve / Return / Reject; Technical-certify; Finance-settle |
| **Signing** | **Aadhaar eSign / DSC (C-DAC)** | Workflow flags `requires_otp` / `requires_digital_signature` exist, **but no eSign gateway is wired** |

---

## 3. Gap table (proposed → current)

Legend: ❌ missing · ⚠️ partial/different · ✅ present · ➕ VPS exceeds

### 3.1 Invoice lifecycle & officer actions
| Capability in proposed VPMS | Current VPS | Gap |
|---|---|---|
| Vendor raises invoice (FY, Month, Basic/Tax/Gross, scanned PDF + related doc, Project) | Invoice submit with amounts + document upload | ⚠️ VPS lacks FY/Month/Project keying & “payment schedule” framing |
| PO: **Forward to OIC / Revert to Vendor / Reject** | Approve / Return / Reject via workflow | ✅ equivalent (naming differs) |
| **Multi-select / batch** action on many invoices at once | One invoice at a time | ❌ **no batch actions** |
| OIC: **Verify / Not Verify** + comment | Technical/Finance review + remarks | ✅ equivalent |
| **Consolidated comment thread** per invoice across roles | Per-step remarks | ⚠️ no single conversation view |
| **“Pending At Role”** column + role-routed status labels | Workflow-progress drawer (“pending at Scrutiny with…”) | ➕ VPS transparency is richer, but no compact “pending-at-role” list column |
| Penalty/SLA (**TPA reports**), **Stocks/Goods payment** capture at verify | Deduction lines (TDS, retention, LD, penalty…) | ⚠️ VPS has deductions but not TPA/stocks constructs |

### 3.2 Digital signing & compliance  ← **biggest gap**
| Proposed | Current VPS | Gap |
|---|---|---|
| **Aadhaar e-KYC eSign** (Aadhaar No/VID/UID + OTP) via C-DAC Hastākshar (`esign.mp.gov.in`) | none (only boolean flags on steps) | ❌ **not implemented** |
| **DSC (token)** signing option | none | ❌ **not implemented** |
| Legally-valid IT-Act digital signature stamped on the invoice/PDF | none | ❌ **not implemented** |

### 3.3 Government / platform integration
| Proposed | Current VPS | Gap |
|---|---|---|
| **e-File No / Computer No** per invoice (e-Office/e-File link) | none | ❌ **no e-File integration** |
| **Ref-No** tracking | none | ❌ |
| Runs inside **MP e-SEVA SSO** portal (multi-module, session timer) | standalone app, own JWT login | ❌ **no eGov SSO integration** |

### 3.4 Contract & procurement metadata
| Proposed | Current VPS | Gap |
|---|---|---|
| **Agency Selection Mode** (Tender / Quotation / Nomination) | not captured | ❌ |
| **Tender/Quotation/Nomination No**, **Tender Platform/Mode**, **Contract Signing Date** | not captured | ❌ (VPS has legal clauses instead) |
| **Service Charge** on work order (applicable, %, type) | line items + GST only | ❌ no explicit service-charge construct |

### 3.5 Reporting & convenience
| Proposed | Current VPS | Gap |
|---|---|---|
| **Export to Excel** on every list | none | ❌ |
| Dedicated **Reports** module | dashboards only | ⚠️ partial |
| Dedicated **Downloads** module (bulk) | per-document download | ⚠️ partial |
| Dashboard KPIs (Total/Pending/Paid invoices, Gross Pending/Paid in Lakh) | dashboards exist | ✅ comparable |

---

## 4. Where the current VPS already **exceeds** the proposal (➕)

The PDF shows a **fixed** PO→OIC→FO flow for a single MP department. VPS is a more general platform:

- **Configurable Rule Engine + Workflow Engine** — approval depth, roles, SLA, escalation, and
  conditional steps are data, not code (the proposed flow is hard-coded).
- **Multi-organisation / multi-tenant** with PostgreSQL **Row-Level Security** (VPMS appears single-dept).
- **Milestone-based billing** and full **GST (CGST/SGST/IGST)** computation.
- **Deduction workflow** with technical-recommend → finance-settle → accounts-override.
- **SLA countdown / overdue timers**, **workflow-progress transparency**, **audit trail**.
- **Contract legal clauses** (scope, payment terms, compliance, indemnification, dispute resolution).
- **Vendor self-registration** + **vendor change-request approval**.

---

## 5. Gaps to close — prioritised

**P1 — core to “be like the document”**
1. **Aadhaar/DSC eSign integration** (C-DAC eSign ASP gateway) — sign the invoice PDF, store the signed
   artifact + signature metadata; gate it behind the existing `requires_digital_signature` step flag.
2. **e-File No / Computer No** field on invoices (+ Ref-No), captured at forward/verify and shown in lists.
3. **Batch (multi-select) invoice actions** for the first-line officer.

**P2 — parity & procurement fidelity**
4. **Agency Selection Mode + tender/quotation/nomination metadata** on contracts; **Contract Signing Date**.
5. **Service Charge (%)** on work orders and its effect on payable computation.
6. **FY / Month / Project / Payment-Schedule** keying on invoices.
7. **Export to Excel** across lists; a basic **Reports** + **Downloads** area.
8. **Consolidated comment thread** and a **“Pending At Role”** list column.

**P3 — platform**
9. **eGov SSO** (MP e-SEVA-style) integration, if this must live inside a state portal.
10. **TPA/SLA-penalty & Stocks/Goods-payment** capture at verification, if in commercial scope.

---

## 6. One-line summary

The current VPS is **architecturally more capable** (configurable rules/workflow, multi-tenant, RLS,
milestones, deductions) but is missing the proposed system’s **government-grade execution details** —
above all **Aadhaar/DSC e-signing**, **e-File/e-Office linkage**, **eGov-SSO hosting**, **batch invoice
actions**, and **tender/service-charge/FY-month** metadata. Closing P1 (eSign + e-File + batch) would
bring VPS functionally in line with the document; P2/P3 achieve full parity.
