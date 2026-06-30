import { distance } from "@turf/distance";
import { point } from "@turf/helpers";
import type { Airport, LatLon, Route, RouteMode, RouteSegment } from "@gcm/shared";
import { estimateTypicalBlockMinutes } from "@gcm/shared";
import { findAirwayPath } from "@/lib/airway-routing";

const ROUTE_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ef4444"];

function geodesicDistanceKm(from: LatLon, to: LatLon): number {
  return distance(point([from.lon, from.lat]), point([to.lon, to.lat]), {
    units: "kilometers",
  });
}

function pathDistanceKm(from: Airport, path: LatLon[], to: Airport): number {
  const points: LatLon[] = [from, ...path, to];
  let total = 0;

  for (let i = 0; i < points.length - 1; i++) {
    total += geodesicDistanceKm(points[i]!, points[i + 1]!);
  }

  return total;
}

function buildSegment(from: Airport, to: Airport, mode: RouteMode): RouteSegment {
  if (mode === "airway") {
    const airwayPath = findAirwayPath(from, to);
    if (airwayPath && airwayPath.length > 0) {
      const distanceKm = pathDistanceKm(from, airwayPath, to);
      return {
        from,
        to,
        distanceKm,
        typicalBlockMinutes: estimateTypicalBlockMinutes(distanceKm),
        path: airwayPath,
      };
    }
  }

  const distanceKm = geodesicDistanceKm(from, to);
  return {
    from,
    to,
    distanceKm,
    typicalBlockMinutes: estimateTypicalBlockMinutes(distanceKm),
  };
}

export function buildRoute(airports: Airport[], id?: string, mode: RouteMode = "great-circle"): Route {
  const segments: RouteSegment[] = [];

  for (let i = 0; i < airports.length - 1; i++) {
    segments.push(buildSegment(airports[i]!, airports[i + 1]!, mode));
  }

  const totalKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  const totalBlockMinutes = segments.reduce(
    (sum, segment) => sum + segment.typicalBlockMinutes,
    0,
  );

  return {
    id: id ?? `route-${crypto.randomUUID()}`,
    airports,
    segments,
    totalKm,
    totalBlockMinutes,
  };
}

export function routeName(airports: Airport[]): string {
  return airports
    .map((airport) => airport.iata || airport.icao)
    .filter(Boolean)
    .join("–");
}

export { ROUTE_COLORS };
