import { createReadStream } from "node:fs";
import { access, mkdir, readdir, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { FAA_NASR_SUBSCRIPTION_URL } from "@gcm/shared";

const execFileAsync = promisify(execFile);

export type NasrCsvPaths = {
  awySegAlt: string;
  fixBase: string;
  navBase: string;
  effectiveDate: string;
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error(`Empty response body for ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(dest));
}

async function unzipSingle(zipPath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  await execFileAsync("unzip", ["-qo", zipPath, "-d", destDir]);
}

async function findCsvFile(dir: string, name: string): Promise<string | null> {
  const direct = join(dir, name);
  if (await exists(direct)) return direct;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findCsvFile(child, name);
      if (found) return found;
    }
  }
  return null;
}

async function resolveFromCsvDir(csvDir: string): Promise<NasrCsvPaths> {
  const awySegAlt = await findCsvFile(csvDir, "AWY_SEG_ALT.csv");
  const fixBase = await findCsvFile(csvDir, "FIX_BASE.csv");
  const navBase = await findCsvFile(csvDir, "NAV_BASE.csv");

  if (!awySegAlt || !fixBase || !navBase) {
    throw new Error(
      `Missing NASR CSV files under ${csvDir}. Expected AWY_SEG_ALT.csv, FIX_BASE.csv, NAV_BASE.csv`,
    );
  }

  const effectiveDate = basename(csvDir).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "unknown";

  return { awySegAlt, fixBase, navBase, effectiveDate };
}

/** Resolve NASR CSV paths from an extracted subscription directory or nested CSV zip. */
export async function resolveNasrCsvPaths(nasrDir: string): Promise<NasrCsvPaths> {
  const direct = await resolveFromCsvDir(nasrDir).catch(() => null);
  if (direct) return direct;

  const csvDataDir = join(nasrDir, "CSV_Data");
  if (await exists(csvDataDir)) {
    const nestedZips = (await readdir(csvDataDir)).filter((name) => name.endsWith(".zip"));
    if (nestedZips.length > 0) {
      const extractDir = join(csvDataDir, "_extracted");
      await unzipSingle(join(csvDataDir, nestedZips[0]!), extractDir);
      return resolveFromCsvDir(extractDir);
    }
    return resolveFromCsvDir(csvDataDir);
  }

  throw new Error(`Could not locate NASR CSV files in ${nasrDir}`);
}

/** Download and extract FAA 28-day NASR subscription; returns path to extracted root. */
export async function fetchNasrSubscription(cacheDir: string): Promise<string> {
  await mkdir(cacheDir, { recursive: true });
  const zipPath = join(cacheDir, "nasr.zip");
  const extractDir = join(cacheDir, "extracted");

  if (!(await exists(extractDir))) {
    console.log(`Fetching ${FAA_NASR_SUBSCRIPTION_URL}...`);
    await downloadFile(FAA_NASR_SUBSCRIPTION_URL, zipPath);
    console.log("Extracting NASR subscription (this may take a minute)...");
    await unzipSingle(zipPath, extractDir);
  }

  return extractDir;
}

export async function withNasrTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = join(tmpdir(), `gcm-nasr-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
