# Changelog

Notable changes to the VPS web app, newest first. API and database changes are in the VPS
repository's `CHANGELOG.md`.

Format: `## <date> — <title>` followed by short bullets. Add the entry in the same pull request as
the change.

## Unreleased

- Application theme: the Super Admin can switch every user between the VPS look (unchanged) and an
  NGPS-inspired look (navy + saffron, Noto Sans, navy table heads, dark-navy sidebar) from Administration →
  Appearance. Mode B is one MUI theme (`src/theme/ngpsTheme.ts`) built from DB tokens with built-in defaults
  (`src/theme/uiTheme.ts`); the look is cached in `localStorage` (`vps.uiTheme`) so a refresh does not flicker,
  re-checked every 10 minutes (`src/lib/useUiThemeSync.ts`), and falls back to VPS on any failure. Sign-in,
  registration and home backdrops now come from CSS variables (same values in the VPS look). Playbook in the
  VPS repository: `docs/playbooks/ngps-theme.md`.
- Layout fixes: Sanction Orders list shows "Sanctioned <date>" and the description only when there is one
  (no "—" placeholder); Contracts list has set column widths and the expiry date on one line; Reports →
  Payment queue columns size to their content with tighter padding so all nine fit at desktop width, amounts on
  one line and the vendor code under the invoice number; Admin page Organisation and Appearance rows aligned.

- Invoice detail → Activity: the approval rail now continues past the last approval level with the invoice's
  lifecycle — Finance settlement, Sanction Order, Payment Order, Disbursement, Payment status, UTR — drawn like
  the approval levels (marker, connector, title, status chip, details, date). `InvoiceLifecycleStages`
  (`src/components/InvoiceLifecycle.tsx`) is passed to `WorkflowProgress` as its new `continuation`. Loaded
  only when the Activity tab opens, in one request.
- Invoice Activity tab is now **one timeline** (`InvoiceActivityTimeline`): each history event is shown under the
  stage it belongs to (e.g. "Submitted" under Level 1), filed by time; the separate history rail is replaced by
  a "Show full history (N)" link that opens the raw audit list. `WorkflowProgress` takes `stepExtras`;
  `StageEvents` (in `Timeline.tsx`) draws the events inside a stage.
- Review fixes: Process Payment Order / Sign in NGPS no longer stay disabled after Back from NGPS (busy only
  while the sign-in URL is fetched); lifecycle dates fall back correctly (bank process date when VPS has no
  disbursal date, no stray "—", date-only values without a time); a bank failure (110) shows Disbursement as
  "Failed at bank" instead of "Processed by bank".

- One **Beneficiary/Vendor** column (`src/components/BeneficiaryCell.tsx`) in Prepare Sanction Order, the
  submit dialog (replaces "Beneficiary" + "Account · IFSC"), Sanction Order detail and the Payment queue:
  account holder (or the vendor's name when there is none) with masked account and IFSC underneath.
  The Payment queue needs the API's new `beneficiaryName` / `accountNumberMasked` / `ifsc` fields.

- "Prepare NGPS Order" renamed to **Prepare Sanction Order** (menu item and page title), described as
  "Select approved invoices for payment processing."
- "NGPS Sanction Orders" renamed to **Sanction Orders** (menu item and page title), described as "Sent
  Sanction Orders, their signing and bank progress, and payment results"; the order detail's fallback
  subtitle is "Sanction Order".
- "Pay via NGPS" menu item renamed to **Process Payment Order** (same NGPS sign-on behind it).
- Prepare Sanction Order no longer shows the NGPS settings line (portal, scheme, category, district,
  demography, frequency, beneficiaries per order).
- Sanction Orders list: "Paid / Failed" column removed (per-line results stay on the order detail);
  "Beneficiaries" (a count) replaced by **Beneficiary/Vendor** — the first line's beneficiary with masked
  account · IFSC, "+N more" when the order has several; column widths set (24/28/12/18/18 %). Needs the
  API's new list fields.
- Sanction Order statuses renamed: NGPS "Locked" (code 20) → **Sanction Order Processed**; "Accepted" (received
  by NGPS, no progress yet) → **Send for Processing**. In the Sanction Orders list every status chip has the
  same width (200 px, label centred on one line) so the column lines up; column widths 20/26/12/22/20 %.
  `StatusChip` takes an optional `sx`.
- Invoices list: once an invoice has been sent in a Sanction Order, its Status shows that order's status (same
  chip and labels as the Sanction Orders screen, e.g. Sanction Order Processed, Rejected) instead of a constant
  "Pending Payment"; it follows the order as its status changes. Status chips there are a uniform 200 px.
- Invoices list: Age column removed; Deduction shown without the "−" sign; amounts kept on one line and
  right-aligned; column widths set (Invoice 24, Type 9, Gross 11, Deduction 11, Net Payable 12, Pending with 13,
  Status 20 %).

- Payment Queue moved from the Payments menu to the first tab of **Reports** ("Payment queue", before
  Officer scorecard; shown only with `payment.queue.view`). `src/pages/PaymentQueuePage.tsx` became
  `src/components/PaymentQueueTable.tsx`; `/finance/queue` and `/payments` redirect to
  `/reports?tab=payment-queue`, as do the Approvals and payment document links. Reports tabs can be opened
  with `?tab=<key>`.

- Record Payment removed: the menu item, `/finance/record-payment` screen, its dialog,
  `invoicesApi.recordPayment` and the `payment.record` permission. "Pay via NGPS" and "Sign in NGPS" are
  shown only to officers linked to an NGPS user (`src/lib/useIsNgpsLinked.ts`, `paymentsApi.ngpsLink()`).
  Needs the API with `GET api/v1/payments/ngps-link`.

- Pay via NGPS (sidebar) and Sign in NGPS (accepted Sanction Order) go straight to NGPS: the
  "Continue to NGPS for payment?" confirmation is removed. The item / button is disabled while the
  sign-on URL is fetched; a failure is shown as an error toast (`src/lib/useNgpsSso.ts`).
- Documentation: copies of the shared VPS docs removed; [docs/README.md](docs/README.md) links to
  them in the VPS repository. `docs/NGPS_FRONTEND.md` renamed to
  [docs/ngps-frontend.md](docs/ngps-frontend.md).

## 2026-10-22 — SMS Notifications screen

- Super Admin screen at `/config/sms` for SMS through the MSDG gateway: gateway status, per-event
  on/off, DLT template ids, test send, recent SMS log. Guarded by `notification.sms.manage`.

## 2026-10-21 — Initial commit

- The web app moved out of the VPS repository's `frontend/` folder into this repository.
