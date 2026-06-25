import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { OURAIRPORTS_CSV_URL } from "@gcm/shared";
import { buildArtifacts, formatSizeReport } from "./build-index.js";
import { buildCodeMap, filterAirports } from "./filter.js";
import { parseCsvFile } from "./parse.js";

async function downloadCsv(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error("Empty response body");
  }
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(dest));
}

async function main(): Promise<void> {
  const csvArg = process.argv.find((arg) => arg.startsWith("--csv="));
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  const outputDir = outputArg?.split("=")[1];

  let csvPath = csvArg?.split("=")[1];
  let tempDir: string | undefined;

  if (!csvPath) {
    tempDir = await mkdtemp(join(tmpdir(), "gcm-csv-"));
    csvPath = join(tempDir, "airports.csv");
    console.log(`Fetching ${OURAIRPORTS_CSV_URL}...`);
    await downloadCsv(OURAIRPORTS_CSV_URL, csvPath);
  }

  console.log(`Building artifacts from ${csvPath}...`);
  const manifest = await buildArtifacts({ csvPath, outputDir });

  const airports = filterAirports(await parseCsvFile(csvPath));
  const byCode = buildCodeMap(airports);
  console.log(formatSizeReport(airports, byCode));
  console.log(`\nDone. Manifest version: ${manifest.version}`);

  if (tempDir) await rm(tempDir, { recursive: true, force: true });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
