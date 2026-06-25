import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import type { CsvRow } from "./types.js";

export async function parseCsvFile(filePath: string): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }),
      )
      .on("data", (row: CsvRow) => rows.push(row))
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}
