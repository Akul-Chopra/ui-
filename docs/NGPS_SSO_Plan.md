# NGPS SSO — Implementation Plan

> The plan used to build the "Pay via NGPS" single sign-on on `feature/ngps-sso-redirect`. Feature details, configuration and testing are in [NGPS_SSO_Integration.md](NGPS_SSO_Integration.md).


## Context
VPS has a sidebar item **Pay via NGPS** (frontend only, uncommitted). Today it shows a confirmation dialog and sends the
browser to a fixed URL. The NGPS Integration Document v1.0 says a "Go to Payment Page" link must:
- **§7.4:** have the Client Portal **server** generate a token **with that user's User Key**, then redirect the browser
  to `SSOLogin.aspx?token={token}`.
- **§7.2:** get the token from `POST /api/Auth` with `{PortalKey, SecurityKey, UserKey}`; `responseValue` is the JWT
  wrapped in `&quot;` → HTML-decode and trim the quotes.
- **§5.8:** generate a fresh token immediately before every redirect; tokens are user-specific.
- **§4.1 / §5.2:** keys never reach the browser. The User Key is **per NGPS user** and decides the user's NGPS role.

So each VPS user stores their own NGPS User Key; PortalKey/SecurityKey are per portal and environment → server config.
Dev targets: local NGPSAPI `https://localhost:7093` and local NGPS portal `http://localhost:62496/SSOLogin.aspx`
(it validates the token via `NGPSPortal/SSOLogin.aspx.cs` → `JwtService`, reads the `UserKey` claim, signs in).

Scope: only what's needed; existing VPS behaviour unchanged apart from what the sidebar click does.

## Step 0 — Branch (user chose: new branch from master)
VPS is on `feature/sms-integration-vps` with uncommitted local edits. To branch cleanly from master without losing them:
1. `git stash push -u -m "local work before ngps-sso"` (keeps vite proxy, appsettings edits, package.json, the
   Pay-via-NGPS edits, docs).
2. `git fetch origin` then `git checkout -b feature/ngps-sso-redirect origin/master`.
3. Bring back the local-dev-only files that don't overlap SMS:
   `git checkout stash@{0} -- frontend/vite.config.ts frontend/src/api/client.ts .claude/launch.json frontend/package.json frontend/package-lock.json frontend/public/web.config src/VPS.API/appsettings.Development.json`
   then unstage them (`git reset -q`) so they stay local, uncommitted.
   `src/VPS.API/appsettings.json`: re-apply only the user's own local edits by hand (not the SMS `Msdg` block).
4. Re-create the Pay-via-NGPS sidebar/nav pieces by hand on this branch (they were mixed with SMS lines in the stash):
   nav item + confirmation dialog, without the SMS menu item/icon. Leave the stash in place so the SMS branch's local
   state can be restored later with `git stash pop` after switching back.

## Backend (C:\Workspace\VPS\src)
1. **Options** `VPS.Infrastructure/Ngps/NgpsOptions.cs` (pattern: `Gst/GstApiOptions.cs`): `SectionName = "Ngps"`,
   `ApiBaseUrl`, `SsoLoginUrl`, `PortalKey`, `SecurityKey`, `TimeoutSeconds = 30`, `IsConfigured`.
2. **Interface** `VPS.Application/Common/Interfaces/INgpsSsoService.cs`:
   `Task<string> GetSsoUrlAsync(Guid userKey, CancellationToken ct)`.
3. **Typed client** `VPS.Infrastructure/Ngps/NgpsSsoService.cs` (pattern: `Gst/ApiSetuGstVerificationService.cs`):
   POST `api/Auth` JSON; parse the envelope case-insensitively (§5.6); domain error unless 200 + `isSuccess`;
   `WebUtility.HtmlDecode(responseValue).Trim('"')` → JWT; return `{SsoLoginUrl}?token={Uri.EscapeDataString(jwt)}`.
   Never log keys or the token. Map 401 → "NGPS rejected the portal keys", network failure → "NGPS is unavailable".
4. **DI** in `VPS.Infrastructure/DependencyInjection.cs` next to the GST client: `Configure<NgpsOptions>` +
   `AddHttpClient<INgpsSsoService, NgpsSsoService>` (BaseAddress, Timeout). In Development only, accept the local
   NGPSAPI dev certificate.
5. **Query** `VPS.Application/Features/Payments/Queries/GetNgpsSsoUrl/GetNgpsSsoUrlQuery.cs` (record + handler in one
   file, like the other Features): `[RequiresPermission(PermissionCodes.Payment.Record)]`; read
   `app_user.ngps_user_key` for `ICurrentUser.UserId` (tenant-scoped, Dapper via `IUnitOfWork`); null → domain error
   "Your VPS account is not linked to an NGPS user. Ask the administrator to set your NGPS User Key."; else return
   `NgpsSsoUrlResult(string RedirectUrl)`.
6. **Endpoint** `PaymentsController`: `[HttpPost("ngps-sso")]` → `POST /api/v1/payments/ngps-sso` (POST: each call mints
   a fresh token, never cacheable).
7. **Database** `database/scripts/V066__ngps_user_key.sql` (V065 is taken by SMS on the other branch; numbering stays
   unique across branches): `SET search_path TO vps, public;`
   `ALTER TABLE app_user ADD COLUMN IF NOT EXISTS ngps_user_key uuid NULL;` Applied by hand with psql (user runs it;
   shared DB). Linking users = SQL `UPDATE` for now; an admin field is a follow-up.
8. **Config** (no keys committed): `appsettings.json` gets an `Ngps` section with URLs and empty keys;
   `appsettings.Development.json` → `ApiBaseUrl: https://localhost:7093/`, `SsoLoginUrl:
   http://localhost:62496/SSOLogin.aspx`; keys via env vars `Ngps__PortalKey` / `Ngps__SecurityKey`.

## Frontend (C:\Workspace\VPS\frontend)
9. `src/api/endpoints.ts`: `paymentsApi.ngpsSso: () => api.post<{ redirectUrl: string }>(`${V1}/payments/ngps-sso`).then(r => r.data)`.
10. `src/layout/Sidebar.tsx`: Continue calls `paymentsApi.ngpsSso()` then `window.location.assign(redirectUrl)`;
    spinner + disabled while pending; on error show `errorMessage(e)` in the dialog, no redirect.
11. `src/layout/navItems.ts`: replace `externalUrl` with a flag `ngpsSso: true`; drop `VITE_NGPS_PAYMENT_URL` from
    `vite-env.d.ts` / `.env.example`.

## Verification
1. `dotnet build` (VPS.API) and `npx tsc -b --noEmit` (frontend); unit test for envelope parsing/HTML-decode with a
   stub `HttpMessageHandler` (pattern: `tests/VPS.UnitTests/Notifications/MsdgSmsGatewayTests.cs` on the SMS branch).
2. Local NGPSAPI + NGPSPortal running; `POST https://localhost:7093/api/Auth` with real local keys returns 200
   (NGPSAPI `Jwt:Key`/`Issuer` must match what the portal's `JwtService` validates). Keys: from an existing portal in
   the NGPS DB or the NGPS team (local onboarding form is blocked by the missing `Portal.Aggregator_Type_By_Portal` SP).
3. User applies V066; set `ngps_user_key` for a test officer to a valid NGPS UserId; set env keys; run VPS API + Vite.
4. Officer with `payment.record` → **Pay via NGPS → Continue** lands on NGPS signed in (not "Response Code 100.6").
5. Negative: user without key → "not linked" message; NGPSAPI stopped → error in dialog; vendor doesn't see the item;
   endpoint 403 without `payment.record`; no Portal/Security key in any browser response.

Nothing is committed or pushed until the user asks.
