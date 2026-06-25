import { ArcLayer, PathLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { Route } from "@gcm/shared";
import { ROUTE_COLORS } from "@/lib/route-engine";

const POLAR_CAP = 85;

export type RoutePath = {
  id: string;
  path: [number, number][];
  color: [number, number, number, number];
};

export type RouteArc = {
  id: string;
  source: [number, number];
  target: [number, number];
  color: [number, number, number, number];
  numSegments: number;
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function latLonToVec(lat: number, lon: number): [number, number, number] {
  const phi = toRad(90 - lat);
  const theta = toRad(lon);
  return [
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
  ];
}

function vecToLatLon(v: [number, number, number]): [number, number] {
  const z = Math.max(-1, Math.min(1, v[2]));
  const lat = 90 - toDeg(Math.acos(z));
  const lon = toDeg(Math.atan2(v[1], v[0]));
  return [lon, lat];
}

function slerp(
  v0: [number, number, number],
  v1: [number, number, number],
  t: number,
): [number, number, number] {
  let dot = v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2];
  dot = Math.max(-1, Math.min(1, dot));
  const omega = Math.acos(dot);
  if (omega < 1e-10) {
    return v0.map((c, i) => c + t * (v1[i]! - c)) as [number, number, number];
  }
  const sinOmega = Math.sin(omega);
  return v0.map(
    (c, i) =>
      (Math.sin((1 - t) * omega) / sinOmega) * c +
      (Math.sin(t * omega) / sinOmega) * v1[i]!,
  ) as [number, number, number];
}

function generateGreatCircleCoords(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  numPoints: number,
): [number, number][] {
  const v0 = latLonToVec(lat1, lon1);
  const v1 = latLonToVec(lat2, lon2);
  const count = Math.max(2, numPoints);

  return Array.from({ length: count }, (_, i) =>
    vecToLatLon(slerp(v0, v1, i / (count - 1))),
  );
}

function crossesPolarCap(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): boolean {
  const sample = generateGreatCircleCoords(lon1, lat1, lon2, lat2, 48);
  const maxLat = Math.max(...sample.map((p) => p[1]));
  const minLat = Math.min(...sample.map((p) => p[1]));
  return maxLat >= POLAR_CAP || minLat <= -POLAR_CAP;
}

function hexToRgba(hex: string, alpha = 255): [number, number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}

export function buildRouteLayers(routes: Route[]): { paths: RoutePath[]; arcs: RouteArc[] } {
  const paths: RoutePath[] = [];
  const arcs: RouteArc[] = [];

  routes.forEach((route, routeIndex) => {
    const color = hexToRgba(ROUTE_COLORS[routeIndex % ROUTE_COLORS.length]!);

    route.segments.forEach((segment, segmentIndex) => {
      const id = `${route.id}-${segmentIndex}`;
      const source: [number, number] = [segment.from.lon, segment.from.lat];
      const target: [number, number] = [segment.to.lon, segment.to.lat];

      if (crossesPolarCap(source[0], source[1], target[0], target[1])) {
        arcs.push({
          id,
          source,
          target,
          color,
          numSegments: Math.max(200, Math.ceil(segment.distanceKm / 20)),
        });
      } else {
        paths.push({
          id,
          path: generateGreatCircleCoords(
            source[0],
            source[1],
            target[0],
            target[1],
            Math.max(128, Math.ceil(segment.distanceKm / 25)),
          ),
          color,
        });
      }
    });
  });

  return { paths, arcs };
}

export function createRouteDeckLayers(paths: RoutePath[], arcs: RouteArc[]): Layer[] {
  const layers: Layer[] = [];

  if (paths.length > 0) {
    layers.push(
      new PathLayer<RoutePath>({
        id: "route-paths",
        data: paths,
        getPath: (path) => path.path,
        getColor: (path) => path.color,
        getWidth: 3,
        widthUnits: "pixels",
        widthMinPixels: 2,
        jointRounded: true,
        capRounded: true,
        wrapLongitude: true,
        parameters: { cullMode: "none" },
        pickable: false,
      }),
    );
  }

  if (arcs.length > 0) {
    const numSegments = Math.max(200, ...arcs.map((arc) => arc.numSegments));

    layers.push(
      new ArcLayer<RouteArc>({
        id: "route-arcs-polar",
        data: arcs,
        greatCircle: true,
        getHeight: 0,
        numSegments,
        getWidth: 3,
        widthMinPixels: 2,
        getSourcePosition: (arc) => arc.source,
        getTargetPosition: (arc) => arc.target,
        getSourceColor: (arc) => arc.color,
        getTargetColor: (arc) => arc.color,
        parameters: { cullMode: "none" },
        pickable: false,
      }),
    );
  }

  return layers;
}
