/** Compact airport tuple: [latE5, lonE5, iata, icao, name, city, country, type] */
export type CompactAirport = [
  number,
  number,
  string,
  string,
  string,
  string,
  string,
  string,
];

export type Airport = {
  lat: number;
  lon: number;
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  type: string;
};

export type RouteSegment = {
  from: Airport;
  to: Airport;
  distanceKm: number;
  typicalBlockMinutes: number;
};

export type Route = {
  id: string;
  airports: Airport[];
  segments: RouteSegment[];
  totalKm: number;
  totalBlockMinutes: number;
};

export type DistanceUnit = "nm" | "km" | "mi";

export type DataManifest = {
  version: string;
  source: string;
  counts: {
    searchable: number;
    byCode: number;
  };
  files: {
    search: string;
    byCode: string;
  };
};

export const OURAIRPORTS_CSV_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";

export function compactToAirport(row: CompactAirport): Airport {
  return {
    lat: row[0] / 1e5,
    lon: row[1] / 1e5,
    iata: row[2],
    icao: row[3],
    name: row[4],
    city: row[5],
    country: row[6],
    type: row[7],
  };
}

export function airportLabel(airport: Airport): string {
  const code = airport.iata || airport.icao;
  return code ? `${code} — ${airport.name}` : airport.name;
}

export function formatDistance(km: number, unit: DistanceUnit): string {
  const value =
    unit === "nm" ? km / 1.852 : unit === "mi" ? km / 1.609344 : km;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${unit}`;
}

export function convertDistance(km: number, unit: DistanceUnit): number {
  return unit === "nm" ? km / 1.852 : unit === "mi" ? km / 1.609344 : km;
}

export {
  estimateTypicalBlockMinutes,
  formatFlightTime,
  FLIGHT_TIME_ASSUMPTIONS,
} from "./flight-time";
