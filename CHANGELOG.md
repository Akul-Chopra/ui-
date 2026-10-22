# Changelog

Notable changes to the VPS web app, newest first. API and database changes are in the VPS
repository's `CHANGELOG.md`.

Format: `## <date> — <title>` followed by short bullets. Add the entry in the same pull request as
the change.

## Unreleased

- Documentation: copies of the shared VPS docs removed; [docs/README.md](docs/README.md) links to
  them in the VPS repository. `docs/NGPS_FRONTEND.md` renamed to
  [docs/ngps-frontend.md](docs/ngps-frontend.md).

## 2026-10-22 — SMS Notifications screen

- Super Admin screen at `/config/sms` for SMS through the MSDG gateway: gateway status, per-event
  on/off, DLT template ids, test send, recent SMS log. Guarded by `notification.sms.manage`.

## 2026-10-21 — Initial commit

- The web app moved out of the VPS repository's `frontend/` folder into this repository.
