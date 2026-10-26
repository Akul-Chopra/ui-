# NGPS in the frontend

What the web app owns of the NGPS integration (Pay via NGPS and Sanction Orders). Everything else — the
requirement, the NGPS document's rules (§ numbers), the API and database design, decisions, open issues
and status — is in **`docs/integrations/ngps.md` in the VPS (API) repository** (formerly `NGPS_INTEGRATION_CONTEXT.md`). That file is the single
source; read it before NGPS work and update it there. This file only lists the frontend side, so the two
never repeat each other.

## Screens and where they live

| Screen | Route | File |
| --- | --- | --- |
| Process Payment Order (sidebar item, was "Pay via NGPS"; also "Sign in NGPS" on an accepted Sanction Order) — redirects to NGPS on click, no confirmation; errors as a toast | — | `src/lib/useNgpsSso.ts` |
| Prepare Sanction Order (pick invoices, preview, send) | `/finance/ngps/prepare` | `src/pages/SanctionOrderPreparationPage.tsx`, `src/components/SanctionOrderSubmitDialog.tsx` |
| Sanction Orders (list; was "NGPS Sanction Orders") | `/finance/ngps/sanction-orders` | `src/pages/SanctionOrdersPage.tsx` |
| Sanction Order detail (Refresh status, Retry, Cancel) | `/finance/ngps/sanction-orders/:id` | `src/pages/SanctionOrderDetailPage.tsx` |
| Status chip used by the list and the detail page | — | `src/components/NgpsStatusChip.tsx` |

Routes are in `src/App.tsx`; menu entries in `src/layout/navItems.ts` (`ngpsSso`, `ngpsSignatory` flags),
rendered by `src/layout/Sidebar.tsx`.

## API calls

All in `src/api/endpoints.ts`, types in `src/api/types.ts`:

| Function | Endpoint |
| --- | --- |
| `paymentsApi.ngpsLink()` | `GET /api/v1/payments/ngps-link` → `{ isLinked }` (used by `src/lib/useIsNgpsLinked.ts`) |
| `paymentsApi.ngpsSso()` | `POST /api/v1/payments/ngps-sso` → `{ redirectUrl }` |
| `ngpsSanctionOrdersApi.setup()` | `GET /api/v1/ngps-sanction-orders/setup` (includes `isSignatory`) |
| `ngpsSanctionOrdersApi.candidates(params)` | `GET /api/v1/ngps-sanction-orders/candidates` |
| `ngpsSanctionOrdersApi.preview(body)` | `POST /api/v1/ngps-sanction-orders/preview` |
| `ngpsSanctionOrdersApi.create(body)` | `POST /api/v1/ngps-sanction-orders` |
| `ngpsSanctionOrdersApi.list(params)` / `get(id)` | `GET /api/v1/ngps-sanction-orders[/{id}]` |
| `ngpsSanctionOrdersApi.retry(id)` / `cancel(id, reason)` / `sync(id)` | `POST /api/v1/ngps-sanction-orders/{id}/retry`, `/cancel`, `/sync` |

## UI rules

- **Who sees what.** The Sanction Order menu items show only for NGPS signatories (Maker / Checker):
  `src/lib/useIsNgpsSignatory.ts` asks `setup()` once per session for users with the
  `payment.ngps.prepare` permission. "Pay via NGPS" (and "Sign in NGPS") show only to officers linked to an NGPS user
  (`useIsNgpsLinked`); no permission is involved. The menu is
  a convenience: the API refuses every Sanction Order call from a non-signatory (`NGPS_NOT_SIGNATORY`).
- **One "Status" only.** Lists and detail pages show a single Status (Pending, Rejected, Cancelled, or the
  NGPS progress once held: Send for Processing (accepted, no code yet), Sanction Order Processed (NGPS
  "Locked", code 20), Payment Order created, Signed…, Sent to bank, Paid, Partially paid,
  Payment failed), built by `sanctionOrderStatus()` in `NgpsStatusChip.tsx`. Never show separate "VPS" and
  "NGPS" statuses. A line of a rejected or cancelled order reads "Not sent".
- **Sanction date** is sent as the local date (`yyyy-MM-dd`) from the submit dialog; the API formats it for
  NGPS.
- **NGPS messages** (including Hindi text from NGPS) are shown as returned, with line breaks kept
  (`white-space: pre-line`).
- No NGPS keys or URLs in the frontend: the API holds them and returns only the SSO redirect URL.
