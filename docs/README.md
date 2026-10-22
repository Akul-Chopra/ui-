# VPS web app — documentation

Docs that are only about this web app live here. Everything shared with the API — what the system
does, architecture, coding standards, integrations, deployment — lives **once** in the VPS (API)
repository under `docs/`, and is linked from here instead of copied.

## In this repository

| Doc | For |
|---|---|
| [../README.md](../README.md) | Run, build (`build`, `build:iis`), env files, Docker/nginx, IIS |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Branch and pull-request workflow (base branch `main`) |
| [../CHANGELOG.md](../CHANGELOG.md) | Changes to the web app |
| [ngps-frontend.md](ngps-frontend.md) | NGPS screens, routes, API calls and UI rules in this app |

## In the VPS (API) repository

Repository: `https://openforge.gov.in/plugins/git/vendorpaymentsystem/VPS.git` (locally
`C:\Workspace\VPS`). Index: `docs/README.md`.

| Doc (path in the VPS repository) | For |
|---|---|
| `docs/product/functionality.md` | Every module, screen and route |
| `docs/product/demo-script.md` | Demo walkthrough and demo accounts |
| `docs/product/gap-analysis.md` | Gap analysis against the proposed VPMS |
| `docs/architecture/coding-standards.md` | Conventions — see its "Frontend" section |
| `docs/integrations/ngps.md` | NGPS working context — read before any NGPS work |
| `docs/integrations/ngps-sso.md` | "Pay via NGPS" single sign-on as built |
| `docs/operations/deployment-iis.md` | Installing/updating both apps on IIS (`/VPS` + `/VPSAPI`) |

## Conventions

Same as the VPS repository (`docs/README.md` there): `docs/<name>.md` in lowercase-hyphen, a
`Last updated` line on docs that record status, no secrets, one copy only, and the doc plus a
CHANGELOG line updated in the same pull request as the change.
