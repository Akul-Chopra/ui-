# VPS frontend — notes for Claude Code

Web app of the Vendor Payment System (NeGD). `README.md` covers setup, build and deployment; this file only
adds the rules that are easy to get wrong.

## Stack and layout

- React 19 + TypeScript, MUI 6 (components and theme) + Tailwind (layout utilities only, scoped to
  `#vps-root`), TanStack Query, Redux Toolkit, React Router 7, Vite 6. Import alias `@/` = `src/`.
- API calls live in `src/api/endpoints.ts`, types in `src/api/types.ts`, the axios client in
  `src/api/client.ts` (base URL from `VITE_API_BASE_URL`).
- The API is a separate repository (`VPS`, `src/VPS.API`). Keep the contract in `endpoints.ts`/`types.ts`
  in step with it; never import anything from outside this repository.

## Commands

- Install: `npm ci`
- Type-check (the `lint` script): `npm run lint`
- Build: `npm run build` (served from `/`); IIS layout `/VPS` + `/VPSAPI`: `npm run build:iis`
- Dev server: `npm run dev` (port 5173, proxies `/api` and `/hubs` to `VITE_DEV_API_TARGET`)

## Rules

- Env files: `.env` (shared defaults, tracked), `.env.example` (template), `.env.iis` (`build:iis`), and
  the git-ignored `.env.local` for one machine's values. Machine-specific values never go in tracked files.
- No secrets in any `VITE_` variable: they are compiled into the browser bundle.
- API endpoints: calls in `src/api/endpoints.ts` (anonymous ones in `src/api/publicRegistration.ts`),
  types in `src/api/types.ts`, all through the `api` instance in `src/api/client.ts`. Never hard-code the
  API host; it comes from `VITE_API_BASE_URL` / the dev proxy. README section 5 has the pattern.
- Docs and other non-app files must never be served or built: keep `server.fs.deny` in `vite.config.ts`,
  the request filtering in `public/web.config`, the 404 rule in `nginx.conf` and `.dockerignore` in step.
- Don't commit or push unless the user asks. Keep `node_modules/`, `dist/`, logs and `.env.local` out.

## Docs

- `CONTRIBUTING.md`: branch and PR workflow (base branch `main`).
- `docs/FUNCTIONALITY.md`: every module and route; `docs/CODING_STANDARDS.md` ("Frontend" section);
  `docs/DEMO_SCRIPT.md`; `docs/VPMS_GAP_ANALYSIS.md`.
- NGPS: `docs/NGPS_FRONTEND.md` (this app's side), `docs/NGPS_SSO_Integration.md`,
  `docs/NGPS_SSO_Plan.md`. The copied docs describe the API side too; paths such as `src/...` or
  `frontend/...` in them refer to the VPS repository layout (`frontend/` is now this repository's root).

## NGPS screens

Before any NGPS work (Pay via NGPS, Sanction Order pages), read `docs/NGPS_FRONTEND.md` and the working
context `NGPS_INTEGRATION_CONTEXT.md` in the VPS repository (`C:\Workspace\VPS` locally), which is the
single source for the integration. Update that file there, never copy it here; update
`docs/NGPS_FRONTEND.md` only for screens, routes, API calls or UI rules. Sanction Order pages
(`SanctionOrder*Page.tsx`, `NgpsStatusChip.tsx`) show one "Status" only, never a separate VPS or NGPS
status.
