# VPS frontend

The web app of the Vendor Payment System (NeGD): React 19, TypeScript, MUI, TanStack Query, Redux Toolkit,
built with Vite. It talks to the **VPS API**, which lives in its own repository (`VPS`, project
`src/VPS.API`; see its `src/VPS.API/README.md`). The API must be running for anything beyond the sign-in
page. This repository has no build-time dependency on the API repository: the only link is the API's URL.

## 1. Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | 20 LTS or newer (22 is used in CI and the Docker image) | `node -v` |
| npm | comes with Node.js | `npm -v` |

## 2. Install

From the repository root:

```bash
npm ci
```

`npm ci` installs exactly what `package-lock.json` pins. Use `npm install` only when you are changing
dependencies.

## 3. Environment files

A fresh clone runs as is: the tracked `.env` points the dev server at the API started from Visual Studio.

| File | Tracked | Used by | Contents |
| --- | --- | --- | --- |
| `.env` | yes | every command | Shared defaults (below) |
| `.env.example` | yes | — | Template for `.env.local` |
| `.env.local` | **no** (git-ignored) | every command | Your machine's own values; overrides `.env` |
| `.env.iis` | yes | `npm run build:iis` | `VITE_BASE_PATH=/VPS/`, `VITE_API_BASE_URL=/VPSAPI`; overrides both above |

Priority, lowest first: `.env` → `.env.local` → `.env.iis` (only for `build:iis`) → environment variables
set in the shell.

| Variable | Used by | Default (`.env`) | Purpose |
| --- | --- | --- | --- |
| `VITE_DEV_API_TARGET` | `npm run dev` | `https://localhost:55844` | Where the dev server proxies `/api` and `/hubs`: the API from Visual Studio. `http://localhost:5280` for `dotnet run`; a deployed API also works, e.g. `https://ngps-uat.nsde.in/VPS_DEV_API`. |
| `VITE_DEV_PORT` | `npm run dev` | `5173` | Port of the dev server. |
| `VITE_BASE_PATH` | `npm run build` | `/` | Path the app is served under, e.g. `/VPS/` for an IIS application. |
| `VITE_API_BASE_URL` | `npm run build` | empty (same origin) | API location baked into a production build. Empty when the SPA and API share an origin (dev proxy, Docker/nginx); a path such as `/VPSAPI` when they are separate IIS applications. |

To change a value on your machine only:

```powershell
Copy-Item .env.example .env.local
```

```bash
cp .env.example .env.local
```

Then edit `.env.local` and restart `npm run dev`. Never put secrets in any of these files: everything with
the `VITE_` prefix ends up in the browser bundle.

## 4. Run in development

1. Start the VPS API (from the `VPS` repository): Visual Studio (F5 on `VPS.API`, listens on
   `https://localhost:55844`) or `dotnet run --project src/VPS.API --urls http://localhost:5280`.
2. Only for `dotnet run` or another address: set `VITE_DEV_API_TARGET` in `.env.local`.
3. Start the dev server:

```bash
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` and `/hubs` to the API, so there is no CORS setup
in development. If the terminal shows `http proxy error ... ECONNREFUSED`, the API is not running or
`VITE_DEV_API_TARGET` points at the wrong port.

## 5. Where API endpoints are written

The API's **address** is never written in code: it comes from the env files (`VITE_DEV_API_TARGET` for the
dev proxy, `VITE_API_BASE_URL` for a build). The API's **endpoints** (paths) are written in `src/api/`:

| File | What goes there |
| --- | --- |
| `src/api/endpoints.ts` | Every signed-in API call, grouped by area: `authApi`, `vendorsApi`, `contractsApi`, `invoicesApi`, `paymentsApi`, `ngpsSanctionOrdersApi`, … Paths start with the `V1` prefix (`/api/v1`); `qs()` builds query strings. |
| `src/api/publicRegistration.ts` | Anonymous calls under `/api/v1/public` (organisations, demo accounts, vendor self-registration). |
| `src/api/types.ts` | Request and response types, hand-written to mirror the API's DTOs. |
| `src/api/client.ts` | The one axios instance (`api`): base URL, bearer token, tenant header, token refresh on 401. Don't create other axios instances or call `fetch` for the API. |

Adding an endpoint, e.g. a new `GET /api/v1/vendors/{id}/bank-accounts`:

1. Add the response type to `src/api/types.ts`:

   ```ts
   export interface BankAccount { id: string; ifsc: string; accountNumberMasked: string; isPrimary: boolean }
   ```

2. Add the call to the matching group in `src/api/endpoints.ts`:

   ```ts
   export const vendorsApi = {
     // ...existing calls
     bankAccounts: (id: string) =>
       api.get<BankAccount[]>(`${V1}/vendors/${id}/bank-accounts`).then((r) => r.data),
   };
   ```

3. Call it from a page through TanStack Query:

   ```ts
   const accounts = useQuery({ queryKey: ['vendor-bank-accounts', id], queryFn: () => vendorsApi.bankAccounts(id) });
   ```

   Use `useMutation` for POST/PUT/DELETE, then invalidate the affected query keys.

The endpoint itself (controller, permissions) is built in the VPS repository; see `CONTRIBUTING.md` for
the order (API first).

## 6. Check and build

```bash
npm run lint        # TypeScript type-check (no emit)
npm run build       # type-check + production build into dist/, served from "/"
npm run build:iis   # the same for IIS: app under /VPS/, API at /VPSAPI (values in .env.iis)
npm run preview     # serve dist/ locally to try the production build
```

## 7. Deploy

The production build is static files in `dist/`.

### IIS

The SPA and the API as two IIS applications on one site, `/VPS` and `/VPSAPI`:

```powershell
npm ci
npm run build:iis
```

Copy everything **inside** `dist/` (`index.html`, `web.config`, `assets/`) into the `/VPS` application
folder; delete the old `assets/` first. `web.config` (from `public/`) sends client-side routes to
`index.html` and needs the IIS URL Rewrite module. The app pool can be "No Managed Code".

Different application names: override the two values for that build (environment variables win over
`.env.iis`), e.g. for `/VPS_DEV_UI` + `/VPS_DEV_API`:

```powershell
$env:VITE_BASE_PATH='/VPS_DEV_UI/'; $env:VITE_API_BASE_URL='/VPS_DEV_API'; npm run build:iis
```

Check `dist/index.html`: its script tag must start with the application path (`src="/VPS_DEV_UI/assets/`).
The variables stay set in that PowerShell window, so use a new window for the next build.

### Docker / nginx

`Dockerfile` builds the app and serves it with nginx, which proxies `/api` and `/hubs` to the API, so the
default empty `VITE_API_BASE_URL` works. The API address is the `VPS_API_UPSTREAM` environment variable
(default `http://api:8080`, the service name in the VPS repository's compose file):

```bash
docker build -t vps-web .
docker run -d -p 3000:80 -e VPS_API_UPSTREAM=http://<api-host>:8080 vps-web
```

## Documentation

| File | Contents |
| --- | --- |
| `CONTRIBUTING.md` | Branch and pull-request workflow |
| `docs/FUNCTIONALITY.md` | Every module, screen and route of the application |
| `docs/CODING_STANDARDS.md` | Conventions (see the "Frontend" section) |
| `docs/DEMO_SCRIPT.md` | Demo walkthrough and demo accounts |
| `docs/VPMS_GAP_ANALYSIS.md` | Gap analysis against the proposed VPMS |
| `docs/NGPS_FRONTEND.md` | NGPS screens, API calls and UI rules in this app |
| `docs/NGPS_SSO_Integration.md`, `docs/NGPS_SSO_Plan.md` | Pay via NGPS single sign-on (record of the feature as built) |

The NGPS integration's working context (requirement, NGPS rules, decisions, open issues, status) is kept
in one place only: `NGPS_INTEGRATION_CONTEXT.md` in the VPS (API) repository. Read it before NGPS work.

The functional and SSO documents were copied from the VPS repository and cover the API as well; paths in
them such as `frontend/src/...` refer to the old layout, where this repository was the `frontend/` folder.

## Developer documents are never served

Notes such as this file stay in the repository only. They are not part of the build (only `index.html`,
`src/` and `public/` are), the dev server refuses `*.md`, `*.docx` and similar files (`server.fs.deny` in
`vite.config.ts`), `public/web.config` blocks those extensions on IIS, `nginx.conf` returns 404 for them,
and `.dockerignore` keeps them out of the image.
