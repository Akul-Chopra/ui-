# Contributing

## Branching & pull-request workflow

`main` is the protected, always-releasable branch. **Do not commit or push
directly to `main`.** Every change lands through a pull request.

1. **Branch off `main`** using a descriptive prefix:
   - `feature/<short-name>` — new functionality
   - `fix/<short-name>` — bug fixes
   - `chore/<short-name>` — tooling, deps, repo hygiene
   - `docs/<short-name>` — documentation only

   ```bash
   git switch main && git pull
   git switch -c feature/vendor-onboarding
   ```

2. **Commit** in logical units with clear messages (imperative mood, e.g.
   "Add mobile-OTP login").

3. **Open a pull request** into `main`. Fill in what changed, why, and how it
   was verified. Keep PRs focused and reviewable.

4. **Merge** only after review and a green build (`npm run lint` and
   `npm run build`). Prefer squash-merge to keep `main` history linear.

A change that needs a new or changed API endpoint is two pull requests: one in
the `VPS` repository (the API) and one here. Merge and deploy the API first, so
the frontend never calls an endpoint that does not exist yet.

## Local development

- **API**: run `VPS.API` from the `VPS` repository (Visual Studio, or
  `dotnet run --project src/VPS.API --urls http://localhost:5280`).
- **Frontend** (React 19 + Vite): `npm ci && npm run dev` from this repository
  (proxies `/api` to the API; set `VITE_DEV_API_TARGET` in `.env.local` when the
  API is not on `http://localhost:5280`). See `README.md`.

Never commit build artifacts (`dist/`, `node_modules/`), logs or `.env.local`
— see `.gitignore`.
