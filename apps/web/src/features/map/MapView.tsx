import { useEffect, useMemo, useRef } from "react";
import { MapboxOverlay } from "@deck.gl/mapbox";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildRouteLayers, createRouteDeckLayers } from "@/lib/route-deck-layers";
import { allMapAirports, useRouteStore } from "@/stores/route-store";
import { useMapStore } from "@/stores/map-store";
import { ProjectionToggle } from "@/features/map/ProjectionToggle";
import { applyProjectionAndSky } from "@/features/map/map-projection";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const deckOverlayRef = useRef<MapboxOverlay | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const routes = useRouteStore((state) => state.routes);
  const draftAirports = useRouteStore((state) => state.draftAirports);
  const projection = useMapStore((state) => state.projection);

  const airports = useMemo(
    () => allMapAirports({ routes, draftAirports }),
    [routes, draftAirports],
  );

  const routeLayers = useMemo(() => buildRouteLayers(routes), [routes]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialProjection = useMapStore.getState().projection;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: initialProjection === "globe" ? 1 : 1.5,
    });

    const deckOverlay = new MapboxOverlay({ interleaved: false, layers: [] });
    deckOverlayRef.current = deckOverlay;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("style.load", () => {
      applyProjectionAndSky(map, useMapStore.getState().projection);
      if (!map.hasControl(deckOverlay)) {
        map.addControl(deckOverlay);
      }
    });

    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      if (map.hasControl(deckOverlay)) {
        map.removeControl(deckOverlay);
      }
      deckOverlayRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      applyProjectionAndSky(map, projection);
      if (projection === "globe") {
        map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [projection]);

  useEffect(() => {
    const overlay = deckOverlayRef.current;
    if (!overlay) return;

    overlay.setProps({
      layers: createRouteDeckLayers(routeLayers.paths, routeLayers.arcs),
    });
  }, [routeLayers]);

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
      map.fitBounds(bounds, {
        padding: projection === "globe" ? 100 : 80,
        maxZoom: projection === "globe" ? 3 : 5,
        duration: 800,
      });
    }
  }, [airports, projection]);

  return (
    <div className="relative h-full w-full">
      <ProjectionToggle />
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
