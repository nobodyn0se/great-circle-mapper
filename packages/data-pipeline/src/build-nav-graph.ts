import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { parse } from "csv-parse";
import type { DataManifest, NavGraph } from "@gcm/shared";
import { FAA_NASR_SUBSCRIPTION_URL } from "@gcm/shared";
import { fetchNasrSubscription, resolveNasrCsvPaths, type NasrCsvPaths } from "./nasr.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = resolve(__dirname, "../../../apps/web/public/data");
const DEFAULT_CACHE = resolve(__dirname, "../../../.cache/nasr");

/** Victor, Jet, RNAV Q/T airways from FAA NASR. */
const AIRWAY_ID_PATTERN = /^[JVQT]/;

function gzipJson(data: unknown): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(data), "utf-8"), { level: 9 });
}

async function parseCsvFile(
  path: string,
  onRow: (row: Record<string, string>) => void,
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    createReadStream(path)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          relax_column_count: true,
          trim: true,
        }),
      )
      .on("data", (row: Record<string, string>) => onRow(row))
      .on("end", () => resolvePromise())
      .on("error", reject);
  });
}

export async function buildNavGraphFromNasr(csv: NasrCsvPaths): Promise<NavGraph> {
  const fixes = new Map<string, { id: string; lat: number; lon: number }>();

  await parseCsvFile(csv.fixBase, (row) => {
    const id = row.FIX_ID?.trim();
    const lat = Number.parseFloat(row.LAT_DECIMAL ?? "");
    const lon = Number.parseFloat(row.LONG_DECIMAL ?? "");
    if (!id || Number.isNaN(lat) || Number.isNaN(lon)) return;
    fixes.set(id, { id, lat, lon });
  });

  await parseCsvFile(csv.navBase, (row) => {
    const id = row.NAV_ID?.trim();
    const lat = Number.parseFloat(row.LAT_DECIMAL ?? "");
    const lon = Number.parseFloat(row.LONG_DECIMAL ?? "");
    if (!id || Number.isNaN(lat) || Number.isNaN(lon)) return;
    if (!fixes.has(id)) {
      fixes.set(id, { id, lat, lon });
    }
  });

  const edges: NavGraph["edges"] = [];
  const edgeKeys = new Set<string>();

  const addEdge = (from: string, to: string, distanceNm: number) => {
    const key = `${from}\0${to}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from, to, distanceNm });
  };

  await parseCsvFile(csv.awySegAlt, (row) => {
    const awyId = row.AWY_ID?.trim();
    if (!awyId || !AIRWAY_ID_PATTERN.test(awyId)) return;

    const from = row.FROM_POINT?.trim();
    const to = row.TO_POINT?.trim();
    const distanceNm = Number.parseFloat(row.MAG_COURSE_DIST ?? "");
    if (!from || !to || !fixes.has(from) || !fixes.has(to)) return;
    if (Number.isNaN(distanceNm) || distanceNm <= 0) return;

    addEdge(from, to, distanceNm);
    addEdge(to, from, distanceNm);
  });

  return {
    version: csv.effectiveDate,
    source: FAA_NASR_SUBSCRIPTION_URL,
    fixes: [...fixes.values()],
    edges,
  };
}

async function updateManifest(outputDir: string, graph: NavGraph): Promise<void> {
  const manifestPath = resolve(outputDir, "manifest.json");
  let manifest: DataManifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as DataManifest;
  } catch {
    manifest = {
      version: new Date().toISOString().slice(0, 10),
      source: FAA_NASR_SUBSCRIPTION_URL,
      counts: { searchable: 0, byCode: 0 },
      files: { search: "airports.search.json.gz", byCode: "airports.by-code.json.gz" },
    };
  }

  manifest.files.navGraph = "nav-graph.json.gz";
  manifest.counts.navFixes = graph.fixes.length;
  manifest.counts.navEdges = graph.edges.length;

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

export async function buildNavGraphArtifacts(options: {
  nasrDir?: string;
  outputDir?: string;
  cacheDir?: string;
}): Promise<NavGraph> {
  const outputDir = options.outputDir ?? DEFAULT_OUTPUT;
  await mkdir(outputDir, { recursive: true });

  let nasrDir = options.nasrDir;
  if (!nasrDir) {
    nasrDir = await fetchNasrSubscription(options.cacheDir ?? DEFAULT_CACHE);
  }

  const csvPaths = await resolveNasrCsvPaths(nasrDir);
  console.log(`Building nav graph from NASR (${csvPaths.effectiveDate})...`);

  const graph = await buildNavGraphFromNasr(csvPaths);
  const gz = gzipJson(graph);

  await writeFile(resolve(outputDir, "nav-graph.json.gz"), gz);
  await updateManifest(outputDir, graph);

  console.log(
    [
      `Nav fixes: ${graph.fixes.length.toLocaleString()}`,
      `Nav edges: ${graph.edges.length.toLocaleString()}`,
      `nav-graph.json.gz: ${(gz.length / 1024).toFixed(0)} KB`,
    ].join("\n"),
  );

  return graph;
}

export function formatNavGraphReport(graph: NavGraph, gzBytes: number): string {
  const rawBytes = Buffer.byteLength(JSON.stringify(graph), "utf-8");
  return [
    `Nav fixes: ${graph.fixes.length.toLocaleString()}`,
    `Nav edges: ${graph.edges.length.toLocaleString()}`,
    `nav-graph raw: ${(rawBytes / 1024 / 1024).toFixed(2)} MB → gz: ${(gzBytes / 1024).toFixed(0)} KB`,
  ].join("\n");
}
