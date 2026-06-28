# Great Circle Mapper

Static great-circle route planner built from OurAirports data. No backend — airport search, distance math, and flight-time estimates run entirely in the browser.

## Stack

- **apps/web** — React 19 + Vite + CesiumJS + MiniSearch + Turf
- **packages/data-pipeline** — TypeScript CLI: OurAirports CSV → gzipped JSON artifacts
- **packages/shared** — Shared types, distance/flight-time helpers

## Quick start

```bash
pnpm install
pnpm data:build    # fetch CSV, generate public/data/*.json.gz (~1 min first run)
pnpm dev           # http://localhost:5173
```

Try a shared route:

```
http://localhost:5173/?routes=JFK-LHR-DXB&units=nm
```

Optional: copy `apps/web/.env.example` to `apps/web/.env` and set `VITE_CESIUM_ION_TOKEN` for Cesium Ion road imagery. Without it, the app uses free CARTO Voyager tiles.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Production build (`apps/web/dist`) |
| `pnpm data:build` | Download OurAirports CSV and rebuild search artifacts |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm --filter @gcm/shared test` | Flight-time unit tests |

## Data pipeline

The pipeline downloads [OurAirports airports.csv](https://davidmegginson.github.io/ourairports-data/airports.csv), filters to airports with valid coordinates and at least one IATA or ICAO code, and writes:

- `apps/web/public/data/manifest.json` — version + file names
- `apps/web/public/data/airports.search.json.gz` — compact airport array for fuzzy search
- `apps/web/public/data/airports.by-code.json.gz` — O(1) IATA/ICAO lookup for URL parsing

ICAO resolution uses `ident` → `gps_code` (fixes the v1 bug where `icao_code`-only filtering dropped airports like OMDB/DXB).

Airport `.gz` artifacts are committed to git so production deploys do not need to run `pnpm data:build`. Re-run that command when refreshing OurAirports data.

## Deployment (Cloudflare Pages)

Build output is static (`apps/web/dist`, ~14 MB). No server or database required.

Choose **one** deployment method below (do not enable both on the same branch).

### Option A — Cloudflare dashboard (Git integration)

Recommended if you prefer Cloudflare to build on every push.

#### 1. Push to GitHub

Create a GitHub repository and push `main`:

```bash
git remote add origin git@github.com:YOUR_USER/great-circle-mapper.git
git push -u origin main
```

#### 2. Create the Pages project

In the [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → select the repo.

**Important:** If you used **Workers Builds** (deploy command defaults to `npx wrangler deploy`), you must change the settings below. Running `wrangler deploy` from the monorepo root causes:

`The Wrangler application detection logic has been run in the root of a workspace instead of targeting a specific project`

| Setting | Value |
|---------|--------|
| Production branch | `main` |
| **Root directory** | **`apps/web`** |
| Build command | `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @gcm/web build` |
| **Deploy command** | **`pnpm run deploy:pages`** |
| Build output directory | *(leave empty when using deploy command)* |

Alternatively, use **classic Pages** (no deploy command): root `/`, build `pnpm install && pnpm build`, output `apps/web/dist`, framework **None** — Cloudflare publishes `dist` automatically with no Wrangler step.

Node.js **20** is pinned via [`.node-version`](.node-version). pnpm is detected from `packageManager` in [`package.json`](package.json).

[`apps/web/wrangler.toml`](apps/web/wrangler.toml) must stay inside `apps/web`, not the repository root.

#### 3. Environment variables (optional)

In Pages → **Settings** → **Environment variables**:

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_CESIUM_ION_TOKEN` | No | Inlined at build time. Omit to use CARTO Voyager basemap. |

Apply to **Production** (and **Preview** if desired), then trigger a new deployment.

### Option B — GitHub Actions (Wrangler deploy)

[`deploy.yml`](.github/workflows/deploy.yml) builds and deploys on every push to `main` when these repository secrets are set:

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | [API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) with **Cloudflare Pages — Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from Cloudflare dashboard → **Workers & Pages** → right sidebar |
| `VITE_CESIUM_ION_TOKEN` | Optional; Cesium Ion basemap at build time |

The first deploy creates the `great-circle-mapper` Pages project automatically. Skip Option A if you use this workflow.

[`apps/web/wrangler.toml`](apps/web/wrangler.toml) lives inside the web app (not the monorepo root) so Wrangler 4 does not treat the workspace root as the project.

### Verify locally before deploy

```bash
pnpm install
pnpm build
pnpm --filter @gcm/web preview   # http://localhost:4173
```

Smoke test: map loads, airport search works, `/?routes=JFK-LHR,BOM-GOI` renders routes and flight times.

### Custom domain

Pages → **Custom domains** → add your domain. Enable **Always Use HTTPS**.

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs typecheck, shared unit tests, and a production build on pushes and pull requests to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) deploys to Cloudflare Pages when Option B secrets are configured.

## Project layout

```
great-circle-mapper/
├── apps/web/              # SPA
├── packages/
│   ├── data-pipeline/     # CSV → artifacts CLI
│   └── shared/            # Types + helpers
└── pnpm-workspace.yaml
```
