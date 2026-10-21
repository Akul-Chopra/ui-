# VPS — Coding Standards & Conventions

The conventions this codebase follows. They are descriptive, not aspirational — the code
already reads this way, and new code should match.

---

## Architecture

**Clean Architecture, dependencies inward only.**

```
Domain  ←  Application  ←  Infrastructure  ←  API
   ↑___________|_______________|______________|   (Shared: no layer affiliation)
```

- **Domain** — entities, enums, domain exceptions. No dependencies, no framework types.
- **Application** — CQRS handlers, DTOs, validators, interfaces, pipeline behaviours. Depends
  on Domain only. Holds the *contracts* Infrastructure implements (`IRuleEngine`,
  `IWorkflowEngine`, `IFileStorage`, …).
- **Infrastructure** — Dapper persistence, the engines, auth, cache, storage, notifications.
- **API** — thin controllers, middleware, the SignalR hub. No business logic.

A controller binds a request, dispatches it through MediatR, and shapes the response.
Authorization, validation, transactions and logging are **pipeline behaviours**, so no
handler can forget them.

---

## CQRS & vertical slices

- One feature = one folder under `Features/<Area>/` with `Commands/`, `Queries/`, `Dtos/`.
- A command or query is a `record` implementing `IRequest<T>`; its validator and handler
  live in the same file. Reading a feature top to bottom shows the whole slice.
- **Commands** implement `ITransactionalRequest` (wrapped in a DB transaction). **Queries**
  do not. Sign-in is the one deliberate exception — see its comment.
- Commands write through `IRepository<T>` (which stamps the audit block and the tenant
  predicate centrally). **Reads are hand-written Dapper SQL** on the query side, because
  list screens and dashboards need joins and aggregates a generic repository cannot express.

---

## Persistence

- **snake_case** everywhere in SQL; Dapper maps it via `MatchNamesWithUnderscores`.
- Money is `numeric(18,2)` — **never `float`**. Percentages/rates are `numeric(9,4)`.
- Timestamps are `timestamptz`, stored UTC. The Dapper handler normalises every write to
  UTC; the client renders in the tenant's zone.
- Every tenant-owned table carries the full audit block and is protected by row-level
  security. New tenant-owned tables must be added to the RLS list in `V012`.
- Dapper row projections are **settable-property classes, not positional records** — the
  underscore convention applies to property assignment but not constructor binding.
- `jsonb` columns are cast in generated SQL by the `_json` naming suffix.
- Sort fields in list queries go through a `SortMap` allow-list with a table-qualified
  tie-breaker — a column name is the one thing that cannot be parameterised.

---

## Security

- Multi-tenancy is enforced **twice**: the repository predicate and PostgreSQL RLS. The
  app connects as `vps_app`, which holds no `BYPASSRLS`.
- Cross-tenant "not found" and "forbidden" both surface as **404** — telling a caller a
  record exists in another tenant is itself a leak.
- Passwords: PBKDF2-HMAC-SHA256, 210k iterations, per-user salt, constant-time verify.
- Tokens embed permissions so authorization needs no DB round trip; access-token life is
  short and refresh tokens rotate on use.
- The audit trail is append-only; `UPDATE`/`DELETE` are revoked from `vps.app_user`.
- Sensitive fields (`PasswordHash`, `TokenHash`, …) are redacted before they reach the
  audit trail.

---

## No hard-coded business logic

This is the concept note's central rule and the codebase's strongest convention. A handler
**asks** the rule engine what to do; it never encodes a threshold, an approval count, or a
deduction formula.

```csharp
// NOT this:
if (workOrder.TotalAmount > 100_000m) requireContract = true;

// This — the threshold is configuration the administrator owns:
var decision = await ruleEngine.EvaluateAsync(context, ct);
if (decision.ContractRequired == true && workOrder.ContractId is null) { … }
```

Fact keys are referenced through the `RuleFacts` constants, never as string literals — a
typo would silently stop a rule matching rather than fail loudly.

---

## Naming & style

- C#: PascalCase types/members, `_camelCase` private fields, file-scoped namespaces,
  primary constructors where they read cleanly, `required` on non-nullable init members
  (except route-supplied command IDs — see their comments).
- Domain exceptions carry a **stable `Code`** (e.g. `CONTRACT_REQUIRED`) the client can
  branch on; the API middleware maps them to the right HTTP status.
- Comments explain **why**, not what. A comment that restates the code is noise; a comment
  that records a decision, a trade-off, or a non-obvious constraint earns its place.

---

## Frontend

- React 19 + TypeScript, strict mode, no `any` at boundaries.
- Server state via **React Query**; app state (auth, theme) via **Redux Toolkit**. Forms
  via **React Hook Form + Zod**.
- MUI owns components and theming; **Tailwind** is used for layout utilities only (its
  preflight is disabled so it does not fight MUI's reset).
- The theme is tinted by the tenant brand colour; light/dark is a persisted preference.
- Navigation and control visibility are **permission-driven** — the same principle the
  backend applies — but the server re-checks every request, so the client gate is a
  convenience, never the control.
- API types are hand-written to mirror the DTOs, so the client depends only on the fields
  it uses.

---

## Testing

- The highest-value targets are the **pure** units: `ConditionEvaluator`,
  `DeductionResolver`, `GstCalculator`, the statutory-identifier and financial-year
  helpers, and the validators. They run without a database and are exhaustive.
- Integration tests run over a **Testcontainers PostgreSQL**, applying the real migration
  scripts and asserting the tenant-isolation properties as the `vps_app` role — the same
  boundary production relies on.
