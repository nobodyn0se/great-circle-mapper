import { distance } from "@turf/distance";
import { point } from "@turf/helpers";
import type { Airport, Route, RouteSegment } from "@gcm/shared";

const ROUTE_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ef4444"];

export function buildRoute(airports: Airport[], id?: string): Route {
  const segments: RouteSegment[] = [];

  for (let i = 0; i < airports.length - 1; i++) {
    const from = airports[i]!;
    const to = airports[i + 1]!;
    const fromPoint = point([from.lon, from.lat]);
    const toPoint = point([to.lon, to.lat]);
    const distanceKm = distance(fromPoint, toPoint, { units: "kilometers" });

    segments.push({ from, to, distanceKm });
  }

  const totalKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);

  return {
    id: id ?? `route-${Date.now()}`,
    airports,
    segments,
    totalKm,
  };
}

export function routeName(airports: Airport[]): string {
  return airports
    .map((airport) => airport.iata || airport.icao)
    .filter(Boolean)
    .join("–");
}

export { ROUTE_COLORS };
