# NGPS Single Sign-On ("Pay via NGPS")

Branch: `feature/ngps-sso-redirect` (VPS, from `master`) · Related NGPS branch: `feature/vps-sso-integration` (no NGPS code changes needed)

An officer clicks **Pay via NGPS** in the VPS sidebar, confirms, and lands in the NGPS portal already signed in as the NGPS Portal Admin, ready to register signatories and map their digital signatures (document §2.1 step 4, §2.3). VPS never handles an NGPS password: it asks NGPS for a short-lived token and redirects the browser with it.

Reference: *NGPS Disbursement – Client Portal Integration Document v1.0*, sections 2, 5 and 7.

## How it works

1. The officer clicks **Pay via NGPS** (visible to users with `payment.record`, hidden from vendors) and confirms in the dialog.
2. The browser calls `POST /api/v1/payments/ngps-sso` on the VPS API.
3. The VPS API reads the officer's NGPS User Key from `app_user.ngps_user_key` and calls NGPS `POST {ApiBaseUrl}api/Auth` with `{ PortalKey, SecurityKey, UserKey }` (document §7.2). Portal and Security keys come from server configuration (environment variables).
4. NGPS checks the keys and that the call comes from a whitelisted IP (§6.10).
5. NGPS returns its standard envelope; `responseValue` is the JWT wrapped in HTML-encoded quotes (`&quot;eyJ…&quot;`). VPS HTML-decodes it and trims the quotes.
6. VPS returns only `{ redirectUrl: "{SsoLoginUrl}?token=<JWT>" }`; the browser navigates there (§7.4).
7. NGPS `SSOLogin.aspx` validates the token, reads its `UserKey` claim and signs the officer in as that NGPS user (for example the Portal Admin, or a signatory), opening the pages allowed for that role.

Rules followed from the document:

| Rule | Where it is applied |
| --- | --- |
| Keys never reach the browser (§4.1, §5.2) | Portal and Security keys live in server config, User Keys in the database; the browser only receives the redirect URL |
| Token is user-specific (§5.8) | Minted with the officer's own User Key, so NGPS opens the pages of that officer's NGPS role |
| Fresh token immediately before each redirect (§5.8, §7.4) | A new token on every click; the endpoint is a POST and is never cached |
| Envelope names are case-insensitive; PascalCase on server errors (§5.6) | Parsed case-insensitively |
| HTML-decode `responseValue` (§5.6, §7.2) | `WebUtility.HtmlDecode` then trim `"` |

## What was built

| Area | File | Purpose |
| --- | --- | --- |
| Options | `src/VPS.Infrastructure/Ngps/NgpsOptions.cs` | `Ngps` config section: URLs, Portal/Security keys, timeout, dev-cert flag |
| Contract | `src/VPS.Application/Common/Interfaces/INgpsSsoService.cs` | `GetSsoUrlAsync(userKey)` |
| NGPS client | `src/VPS.Infrastructure/Ngps/NgpsSsoService.cs` | Calls `api/Auth`, decodes the token, builds the SSO URL, maps failures to clear messages; never logs keys or tokens |
| Registration | `src/VPS.Infrastructure/DependencyInjection.cs` | Typed `HttpClient`; accepts a self-signed cert only when `AcceptUntrustedCertificate` is true |
| Query | `src/VPS.Application/Features/Payments/Queries/GetNgpsSsoUrl/GetNgpsSsoUrlQuery.cs` | Permission `payment.record`; reads the officer's `ngps_user_key`; "not linked" error if missing |
| Endpoint | `src/VPS.API/Controllers/PaymentsController.cs` | `POST /api/v1/payments/ngps-sso` → `{ redirectUrl }` |
| Config | `src/VPS.API/appsettings.json`, `appsettings.Development.json` | `Ngps` section (URLs only, no keys) |
| Sidebar item | `frontend/src/layout/navItems.ts` | "Pay via NGPS" under Payments, flag `ngpsSso: true` |
| Dialog | `frontend/src/components/NgpsSsoDialog.tsx` | Confirm → call API → redirect; spinner while waiting; shows the server's message on failure |
| Sidebar | `frontend/src/layout/Sidebar.tsx` | Opens the dialog for the NGPS item |
| API client | `frontend/src/api/endpoints.ts` | `paymentsApi.ngpsSso()` |
| Tests | `tests/VPS.UnitTests/Ngps/NgpsSsoServiceTests.cs` | Token decoding, PascalCase envelope, 401, non-JSON failure, missing keys |

| Database | `database/scripts/V066__ngps_user_key.sql` | Nullable `app_user.ngps_user_key uuid`: the officer's NGPS User Key |

Error messages the officer can see:

| Situation | Message |
| --- | --- |
| No `ngps_user_key` on the account | Your VPS account is not linked to an NGPS user. Ask the administrator to set your NGPS User Key. |
| Keys not configured on the server | NGPS single sign-on is not configured on this server. Contact the administrator. |
| NGPS returns 401 | NGPS did not accept the sign-on credentials for your account. Contact the administrator. |
| NGPS unreachable / timeout | NGPS is not reachable right now. Please try again later. |
| Any other NGPS failure (including 502) | NGPS could not sign you in right now. Please try again later. |

If NGPS itself refuses the token after the redirect, NGPS shows its own response code (§7.4): 100.6 expired/invalid token, 101.6 locked, 101.7 not approved, 106 user not registered on NGPS.

## Configuration

| Setting | `appsettings.json` | `appsettings.Development.json` | Secret? |
| --- | --- | --- | --- |
| `Ngps:ApiBaseUrl` | `https://ngps-uat.nsde.in/gateway/` | same (UAT) | No |
| `Ngps:SsoLoginUrl` | `https://ngps-uat.nsde.in/SSOLogin.aspx` | same (UAT) | No |
| `Ngps:PortalKey` | empty | — | **Yes**: env var `Ngps__PortalKey` |
| `Ngps:SecurityKey` | empty | — | **Yes**: env var `Ngps__SecurityKey` |
| `Ngps:AcceptUntrustedCertificate` | `false` | `false` | No |

UAT: Portal ID 1026, host `ngps-uat.nsde.in`. Production URLs and keys come from the production onboarding (staging and production keys differ).

Linking an officer to their NGPS user (the User Key issued by NGPS for that person):

```sql
UPDATE vps.app_user SET ngps_user_key = '<NGPS User Key>' WHERE user_name = '<VPS login>';
```

## Local setup and testing

1. Set the keys for the VPS API process (PowerShell, or the IIS app pool's environment variables on a server):
   ```powershell
   $env:Ngps__PortalKey = "<portal key>"; $env:Ngps__SecurityKey = "<security key>"
   ```
2. Link the officer's VPS account with the `UPDATE` above (V066 must be applied).
3. Check the keys directly: `POST https://ngps-uat.nsde.in/gateway/api/Auth` with the three keys must return 200 with a message ending in "Role PortalAdmin". 401 means wrong keys; "IP Address … is not Enabled" means this machine's public IP is not whitelisted (§6.10); 502 means the NGPS API is down.
4. Start the VPS API and the Vite dev server, sign in as the linked officer, click **Pay via NGPS → Continue to NGPS**. You should land in NGPS signed in as that officer's NGPS user (Portal Admin → signatory registration).
5. Negative checks: an officer without a key sees the "not linked" message; with the keys unset the dialog shows "not configured"; with NGPS unreachable it shows "not reachable"; a vendor does not see the item; the endpoint returns 403 without `payment.record`; no key appears in any browser response (DevTools → Network).

Automated: `dotnet test tests/VPS.UnitTests` (5 NGPS tests) and `npx tsc -b --noEmit` in `frontend`.

## Pending

- [x] UAT Portal Key, Security Key and Portal Admin User Key received (Portal ID 1026). Portal Admin's NGPS user: `mayank.chaubey@negd.in`.
- [ ] NGPS UAT `https://ngps-uat.nsde.in/gateway/api/Auth` returns HTTP 502 (the NGPS API behind the gateway is down) — NGPS to fix.
- [ ] Whitelist the VPS server's IP/domain on NGPS for each environment (§6.10).
- [ ] Rename the "Pay via NGPS" menu item (it is also the Portal Admin / signatory entry to NGPS).
