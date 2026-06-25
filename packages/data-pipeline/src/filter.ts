import type { CompactAirport } from "@gcm/shared";
import type { CsvRow } from "./types.js";

function resolveIcao(row: CsvRow): string {
  const candidate = (row.ident || row.gps_code || "").trim().toUpperCase();
  if (candidate.length === 0 || candidate.length > 4) return "";
  return candidate;
}

function resolveIata(row: CsvRow): string {
  const candidate = (row.iata_code || "").trim().toUpperCase();
  return candidate.length === 3 ? candidate : "";
}

export function filterAirports(rows: CsvRow[]): CompactAirport[] {
  const airports: CompactAirport[] = [];

  for (const row of rows) {
    if (!row.id || row.type === "closed") continue;

    const lat = Number.parseFloat(row.latitude_deg);
    const lon = Number.parseFloat(row.longitude_deg);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const icao = resolveIcao(row);
    const iata = resolveIata(row);
    if (!icao && !iata) continue;

    airports.push([
      Math.round(lat * 1e5),
      Math.round(lon * 1e5),
      iata,
      icao,
      row.name.trim(),
      (row.municipality || "").trim(),
      (row.iso_country || "").trim(),
      row.type.trim(),
    ]);
  }

  return airports;
}

export function buildCodeMap(
  airports: CompactAirport[],
): Record<string, number> {
  const map: Record<string, number> = {};

  airports.forEach((airport, index) => {
    const [, , iata, icao] = airport;
    if (iata) map[iata] = index;
    if (icao) map[icao] = index;
  });

  return map;
}
