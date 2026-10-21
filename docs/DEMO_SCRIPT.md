# VPS — Presentation Demo Script

A 15-minute walkthrough that covers every POC deliverable in the concept note, in the
order that tells the best story. Each step names what to show and the point it makes.

**Before you start**
- API running (`dotnet run --project src/VPS.API`), frontend running (`cd frontend && npm run dev`).
- Open `http://localhost:5173`.
- Password for every demo account: **`Vps@2026#Demo`**.

---

## Act 1 — Multi-tenancy and the branded shell (2 min)

1. **Sign in** at the login screen as organisation *National eGovernance Division*, user
   `negd.admin`. Point out the organisation picker — the same platform serves any ministry.
2. Land on the **dashboard**. Note the teal branding, the ministry name in the header, and
   the KPI tiles / charts fed by live data.
3. **Sign out, sign in to *Ministry of Ports, Shipping & Waterways*** as `mopsw.admin`.
   The whole console **re-skins to forest green** and shows a different department set and
   data. *"Same code, same database, different ministry — isolated and re-branded."*
   > The isolation is enforced twice — repository predicate and PostgreSQL row-level
   > security — and proven by the `database/verify_tenant_isolation.sql` checks.

Sign back in as `negd.admin` for the rest.

---

## Act 2 — The configurable rule engine (4 min) — *the headline*

4. Open **Rule Engine** (Oversight → Rule Engine). Select **Work Order — Contract
   Requirement**. Show the rule reading in plain language: *WorkOrder.TotalAmount > ₹1,00,000
   → RequireContract*, plus the default "otherwise optional" branch.
5. Scroll to the **Simulator**. Enter `WorkOrder.TotalAmount = 500000`, run it →
   **Contract required = TRUE**, with the "why" trace: `500000 GreaterThan 100000 => True`.
6. **Change the threshold live.** Click the edit pencil on the ₹1,00,000 value, set it to
   `1000000`, save. A toast confirms the new version is effective immediately.
7. **Re-run the same simulation** (₹5,00,000) → now **Contract required = FALSE**. *"I
   changed a government business rule, and the next work order already behaves differently —
   no code, no redeployment, no developer."*
   - Restore the threshold to `100000` afterward to keep the baseline.

This single act is the concept note's central promise, demonstrated end to end.

---

## Act 3 — The procurement-to-payment lifecycle (6 min)

Tell it as one vendor's journey. (The data already exists from prior runs; you can also
create fresh records live via the API/Swagger if you prefer.)

8. **Vendors** — open the list. Point out GST-led registration, MSME classification,
   verification status and rating. *"Registration validates the GSTIN and cross-checks the
   PAN embedded in it."*
9. **Contracts** — show a contract with its committed-vs-total progress bar and the
   expiry indicator.
10. **Work Orders** — show an order linked to a contract, with its billable balance and
    (for larger orders) the **milestone schedule the rule engine generated** (20/40/60/80/100).
11. **Invoices** — the centrepiece. Open an invoice's drawer:
    - The **money summary**: gross, deduction, net payable.
    - The **Deductions tab**: the technical officer's **recommendation** (₹5,000) *beside*
      the finance officer's **override** (₹8,000) with the mandatory **override reason**,
      and each deduction line tagged rule / recommendation / approved.
    - *"The concept note asks that finance can override the technical recommendation. Here
      both figures survive, with the reason — fully auditable."*
    - The **Timeline tab**: the document's whole life — Submitted → Technical Certification
      → Finance Settlement → Payment Advice — interleaving audit and approval events with
      who did each.
12. **Payment Queue** — finance-settled invoices awaiting disbursement, oldest first, with
    ageing indicators and the frozen payee bank status. *"The advice freezes the bank
    details at sanction; disbursement records the UTR and cascades to the invoice, work
    order and contract."*

---

## Act 4 — Workflow, audit and oversight (2 min)

13. **Workflows** — open *Invoice Processing*. Show the four steps as a stepper, each with
    its role, SLA, and the OTP / digital-signature requirements. *"Routes are configured,
    not coded; a running approval pins the version it started under, so editing a route
    never disturbs work in flight."*
14. **Audit Trail** — the append-only record: who, when, from which IP, and the field-level
    before/after diff. Filter or search to show a specific document's history.
15. **Theme toggle** (top bar) — flip to dark mode to show the console is fully themed for
    long government-console sessions.

---

## Act 5 — The vendor's side (1 min, optional)

16. Sign in as `vendor.bharatinfotech`. The **vendor portal** shows only that vendor's own
    work orders, invoices and payments — the same screens, scoped to them. *"One product,
    two audiences; a supplier can never see another supplier's data."*

---

## Closing line

*"Every threshold, approval route, deduction rule and notification is configuration the
administrator owns. This is not a prototype wired for a demo — it is production
architecture: multi-tenant, audited end to end, and reusable across every government
organisation, exactly as the concept note asks."*

---

## Quick reference — demo accounts (org `negd`)

| Username | Role | Shows |
|---|---|---|
| `negd.admin` | Tenant Admin | everything |
| `negd.contract` | Contract Officer | contracts, work orders |
| `negd.technical` | Technical Officer | invoice technical review |
| `negd.finance` | Finance Officer | invoice finance review, payment queue |
| `negd.payment` | Payment Officer | disbursement |
| `negd.auditor` | Auditor | audit trail, read-only everywhere |
| `vendor.bharatinfotech` | Vendor | the vendor portal |

Org `mopsw`: `mopsw.admin`, `mopsw.finance`, `vendor.coastalworks`.
