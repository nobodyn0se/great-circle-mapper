import type { FeatureCollection, LineString } from "geojson";
import { distance } from "@turf/distance";
import { greatCircle } from "@turf/great-circle";
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

export function buildRouteGeoJson(routes: Route[]): FeatureCollection {
  const features = routes.flatMap((route, routeIndex) => {
    const color = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length]!;

    return route.segments.map((segment, segmentIndex) => {
      const fromPoint = point([segment.from.lon, segment.from.lat]);
      const toPoint = point([segment.to.lon, segment.to.lat]);
      const arc = greatCircle(fromPoint, toPoint, {
        npoints: Math.max(64, Math.ceil(segment.distanceKm / 100)),
      });

      const geometry = arc.geometry as LineString;
      const coordinates = Array.isArray(geometry.coordinates[0]?.[0])
        ? (geometry.coordinates as unknown as number[][][]).flat()
        : geometry.coordinates;

      return {
        type: "Feature" as const,
        properties: {
          routeId: route.id,
          segmentIndex,
          color,
        },
        geometry: {
          type: "LineString" as const,
          coordinates,
        },
      };
    });
  });

  return { type: "FeatureCollection", features };
}

export function routeName(airports: Airport[]): string {
  return airports
    .map((airport) => airport.iata || airport.icao)
    .filter(Boolean)
    .join("–");
}

export { ROUTE_COLORS };
