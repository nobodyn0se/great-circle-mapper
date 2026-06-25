import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildRouteGeoJson } from "@/lib/route-engine";
import { allMapAirports, useRouteStore } from "@/stores/route-store";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const routes = useRouteStore((state) => state.routes);
  const draftAirports = useRouteStore((state) => state.draftAirports);

  const airports = useMemo(
    () => allMapAirports({ routes, draftAirports }),
    [routes, draftAirports],
  );

  const routeGeoJson = useMemo(() => buildRouteGeoJson(routes), [routes]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: 1.5,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      map.addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "routes-line",
        type: "line",
        source: "routes",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.5,
        },
      });
    });

    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateRoutes = () => {
      const source = map.getSource("routes") as maplibregl.GeoJSONSource | undefined;
      source?.setData(routeGeoJson);
    };

    if (map.isStyleLoaded()) updateRoutes();
    else map.once("load", updateRoutes);
  }, [routeGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    for (const airport of airports) {
      const code = airport.iata || airport.icao;
      const marker = new maplibregl.Marker({ color: "#2563eb" })
        .setLngLat([airport.lon, airport.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setHTML(
            `<strong>${code}</strong><br/>${airport.name}<br/><span style="opacity:.75">${airport.city}, ${airport.country}</span>`,
          ),
        )
        .addTo(map);
      markersRef.current.push(marker);
    }

    if (airports.length >= 2) {
      const bounds = new maplibregl.LngLatBounds();
      airports.forEach((airport) => bounds.extend([airport.lon, airport.lat]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 5, duration: 800 });
    }
  }, [airports]);

  return <div ref={containerRef} className="h-full w-full" />;
}
