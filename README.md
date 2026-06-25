# Great Circle Mapper

Static great-circle route planner built from OurAirports data. No backend — airport search and distance math run entirely in the browser.

## Stack

- **apps/web** — React 19 + Vite + MapLibre + MiniSearch + Turf
- **packages/data-pipeline** — TypeScript CLI: OurAirports CSV → gzipped JSON artifacts
- **packages/shared** — Shared types and utilities

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

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Production build |
| `pnpm data:build` | Download OurAirports CSV and rebuild search artifacts |
| `pnpm typecheck` | Typecheck all packages |

## Data pipeline

The pipeline downloads [OurAirports airports.csv](https://davidmegginson.github.io/ourairports-data/airports.csv), filters to airports with valid coordinates and at least one IATA or ICAO code, and writes:

- `apps/web/public/data/manifest.json` — version + file names
- `apps/web/public/data/airports.search.json.gz` — compact airport array for fuzzy search
- `apps/web/public/data/airports.by-code.json.gz` — O(1) IATA/ICAO lookup for URL parsing

ICAO resolution uses `ident` → `gps_code` (fixes the v1 bug where `icao_code`-only filtering dropped airports like OMDB/DXB).

## Deployment

Build output is static (`apps/web/dist`). Deploy to Cloudflare Pages, Vercel, or Netlify. No server or database required.

## Project layout

```
great-circle-mapper/
├── apps/web/              # SPA
├── packages/
│   ├── data-pipeline/     # CSV → artifacts CLI
│   └── shared/            # Types + helpers
└── pnpm-workspace.yaml
```
