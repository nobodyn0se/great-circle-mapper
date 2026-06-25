import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CompactAirport, DataManifest } from "@gcm/shared";
import { OURAIRPORTS_CSV_URL } from "@gcm/shared";
import { buildCodeMap, filterAirports } from "./filter.js";
import { parseCsvFile } from "./parse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = resolve(__dirname, "../../../apps/web/public/data");

function gzipJson(data: unknown): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(data), "utf-8"), { level: 9 });
}

export async function buildArtifacts(options: {
  csvPath: string;
  outputDir?: string;
}): Promise<DataManifest> {
  const outputDir = options.outputDir ?? DEFAULT_OUTPUT;
  await mkdir(outputDir, { recursive: true });

  const rows = await parseCsvFile(options.csvPath);
  const airports = filterAirports(rows);
  const byCode = buildCodeMap(airports);

  const manifest: DataManifest = {
    version: new Date().toISOString().slice(0, 10),
    source: OURAIRPORTS_CSV_URL,
    counts: {
      searchable: airports.length,
      byCode: Object.keys(byCode).length,
    },
    files: {
      search: "airports.search.json.gz",
      byCode: "airports.by-code.json.gz",
    },
  };

  await writeFile(
    resolve(outputDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  await writeFile(
    resolve(outputDir, "airports.search.json.gz"),
    gzipJson(airports),
  );
  await writeFile(
    resolve(outputDir, "airports.by-code.json.gz"),
    gzipJson(byCode),
  );

  return manifest;
}

export function formatSizeReport(
  airports: CompactAirport[],
  byCode: Record<string, number>,
): string {
  const searchRaw = JSON.stringify(airports).length;
  const byCodeRaw = JSON.stringify(byCode).length;
  const searchGz = gzipSync(Buffer.from(JSON.stringify(airports))).length;
  const byCodeGz = gzipSync(Buffer.from(JSON.stringify(byCode))).length;

  return [
    `Airports: ${airports.length.toLocaleString()}`,
    `Code aliases: ${Object.keys(byCode).length.toLocaleString()}`,
    `search.json raw: ${(searchRaw / 1024).toFixed(0)} KB → gz: ${(searchGz / 1024).toFixed(0)} KB`,
    `by-code.json raw: ${(byCodeRaw / 1024).toFixed(0)} KB → gz: ${(byCodeGz / 1024).toFixed(0)} KB`,
  ].join("\n");
}
