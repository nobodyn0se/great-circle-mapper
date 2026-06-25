import type { DistanceUnit } from "@gcm/shared";

export function parseRouteParam(param: string): string[][] {
  return param
    .split(/[,;]/)
    .map((route) =>
      route
        .split("-")
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
    )
    .filter((route) => route.length >= 2);
}

export function encodeRoutes(
  routes: Array<{ airports: Array<{ iata: string; icao: string }> }>,
): string {
  return routes
    .map((route) =>
      route.airports
        .map((airport) => airport.iata || airport.icao)
        .filter(Boolean)
        .join("-"),
    )
    .join(",");
}

export function readRoutesFromUrl(): string[][] {
  const param = new URLSearchParams(window.location.search).get("routes");
  return param ? parseRouteParam(param) : [];
}

export function readUnitsFromUrl(): DistanceUnit {
  const units = new URLSearchParams(window.location.search).get("units");
  if (units === "km" || units === "mi" || units === "nm") return units;
  return "nm";
}

export function syncUrl(
  routes: Array<{ airports: Array<{ iata: string; icao: string }> }>,
  units: DistanceUnit,
): void {
  const params = new URLSearchParams();
  const encoded = encodeRoutes(routes);
  if (encoded) params.set("routes", encoded);
  if (units !== "nm") params.set("units", units);

  const query = params.toString();
  const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, "", next);
}
