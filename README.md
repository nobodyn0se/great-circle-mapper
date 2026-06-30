# Great Circle Mapper

Static route planner built from OurAirports data. No backend — airport search, distance math, and flight-time estimates run entirely in the browser.

Toggle **Great circle** (direct geodesic) or **Airways** (published airway path when nav data is available) in the map controls. Airway mode persists in local storage; without a nav-graph artifact it falls back to great-circle routing.

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

### Airway routing (future)

Airway mode is wired in the UI and route engine. When `apps/web/public/data/nav-graph.json.gz` is added by a future CIFP/nav-graph pipeline, the app will load it automatically and route along published fixes. Until then, airway mode falls back to great-circle distances and paths.

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

#### 2. Connect via Workers Builds (recommended)

In the [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Worker** → **Connect to Git** → select the repo.

This app deploys as a **Worker with static assets** (`wrangler deploy`), not `wrangler pages deploy`. Workers Builds auto-generates an API token with Worker permissions; Pages deploy requires a separate **Cloudflare Pages — Edit** token and will fail with `Authentication error [code: 10000]` if you use `pages deploy` here.

| Setting | Value |
|---------|--------|
| Production branch | `main` |
| **Root directory** | **`/`** |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| **Deploy command** | **`pnpm run deploy`** |

After deploy succeeds, the log should include **`Read 452 files from the assets directory`** (count may vary slightly). If you see only a tiny upload (~0.35 KiB) with no assets line, static files were not packaged — check that `apps/web/dist` exists before deploy runs.

**Do not** set `CLOUDFLARE_API_TOKEN` in build variables unless you create a custom token — the auto-generated Workers Builds token is enough for `wrangler deploy`. A manually added token without Worker permissions will break deploy.

Node.js **22** is pinned via [`.node-version`](.node-version) (required by Wrangler 4.87+). pnpm is detected from `packageManager` in [`package.json`](package.json).

[`apps/web/wrangler.toml`](apps/web/wrangler.toml) must stay inside `apps/web`, not the repository root.

#### 2b. Classic Pages (alternative, no deploy command)

**Pages** → **Connect to Git** → root `/`, build `pnpm install --frozen-lockfile && pnpm build`, output `apps/web/dist`, framework **None**. Cloudflare publishes `dist` automatically — no Wrangler deploy step and no deploy command field.

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
| `CLOUDFLARE_API_TOKEN` | [API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) with **Workers Scripts — Edit** (or **Edit Cloudflare Workers** template) |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from Cloudflare dashboard → **Workers & Pages** → right sidebar |
| `VITE_CESIUM_ION_TOKEN` | Optional; Cesium Ion basemap at build time |

The first deploy creates or updates the `great-circle-mapper` Worker automatically. Skip Option A if you use this workflow.

[`apps/web/wrangler.toml`](apps/web/wrangler.toml) lives inside the web app (not the monorepo root) so Wrangler 4 does not treat the workspace root as the project.

### Verify locally before deploy

```bash
pnpm install
pnpm build
pnpm --filter @gcm/web preview   # http://localhost:4173
cd apps/web && pnpm exec wrangler deploy --dry-run   # expect ~452 files from dist
```

Smoke test: map loads, airport search works, `/?routes=JFK-LHR,BOM-GOI` renders routes and flight times.

### Troubleshooting: site shows "Hello world"

Cloudflare's default Worker template returns plain-text `Hello world`. Your app is a **static asset** deploy — if assets never uploaded, the old template keeps running.

1. **Confirm the URL** — use `https://great-circle-mapper.<subdomain>.workers.dev` (from **Workers & Pages → great-circle-mapper → Domains**), not the bare `https://<subdomain>.workers.dev`.
2. **Check deploy logs** — after `pnpm run deploy`, look for `Read … files from the assets directory …/apps/web/dist`. No assets line = build output missing or deploy ran from the wrong directory.
3. **Dashboard worker code** — **Workers & Pages → great-circle-mapper → Edit code**. If you see the default `Hello world` script, it was never replaced. **Retry deployment** from the **Deployments** tab (or push a commit after the deploy script fix).
4. **Deploy command** must be `pnpm run deploy` (runs `wrangler deploy --assets ./dist` from `apps/web`), not `deploy:pages` or bare `npx wrangler deploy` from the repo root.
5. **Verify in browser** — `curl -I https://great-circle-mapper.<subdomain>.workers.dev` should show `content-type: text/html`, not `text/plain`.

Changing your **workers.dev subdomain** only changes the hostname; it does not redeploy assets. Retry a deployment after changing the subdomain.

### Custom domain

**Workers & Pages → great-circle-mapper → Domains → Add → Custom domain**. Enable **Always Use HTTPS** on the zone.

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs typecheck, shared unit tests, and a production build on pushes and pull requests to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) deploys to Cloudflare Workers when Option B secrets are configured.

## Project layout

```
great-circle-mapper/
├── apps/web/              # SPA
├── packages/
│   ├── data-pipeline/     # CSV → artifacts CLI
│   └── shared/            # Types + helpers
└── pnpm-workspace.yaml
```
