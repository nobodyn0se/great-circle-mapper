import type maplibregl from "maplibre-gl";
import type { MapProjection } from "@/stores/map-store";

export function applyProjectionAndSky(map: maplibregl.Map, projection: MapProjection): void {
  map.setProjection({ type: projection });

  if (projection === "globe") {
    map.setSky({
      "sky-color": "#0b1020",
      "horizon-color": "#3a4a6b",
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
    });
  } else {
    map.setSky({
      "atmosphere-blend": 0,
    });
  }
}
