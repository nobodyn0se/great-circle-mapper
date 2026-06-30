import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  LabelStyle,
  VerticalOrigin,
  type Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { Airport, Route } from "@gcm/shared";
import { ROUTE_COLORS } from "@/lib/route-engine";
import { allMapAirports, useRouteStore } from "@/stores/route-store";
import { useMapStore } from "@/stores/map-store";
import { ProjectionToggle } from "@/features/map/ProjectionToggle";
import { RouteModeToggle } from "@/features/map/RouteModeToggle";
import { MapControls, flyHomeView } from "@/features/map/MapControls";
import {
  applyMapProjection,
  createCesiumViewer,
  cssColorToCesium,
  fitCameraToAirports,
} from "@/features/map/cesium-config";

function segmentEntityId(routeId: string, segmentIndex: number): string {
  return `${routeId}-seg-${segmentIndex}`;
}

function airportEntityId(airport: Airport): string {
  const code = airport.iata || airport.icao;
  return `airport-${code}-${airport.icao}`;
}

function isSegmentEntityId(id: string): boolean {
  return id.includes("-seg-");
}

function isAirportEntityId(id: string): boolean {
  return id.startsWith("airport-");
}

function airportDescription(airport: Airport, code: string): string {
  return `<strong>${code}</strong><br/>${airport.name}<br/><span style="opacity:.75">${airport.city}, ${airport.country}</span>`;
}

function segmentPositions(segment: Route["segments"][number]): number[] {
  const coords: number[] = [segment.from.lon, segment.from.lat];

  if (segment.path) {
    for (const fix of segment.path) {
      coords.push(fix.lon, fix.lat);
    }
  }

  coords.push(segment.to.lon, segment.to.lat);
  return coords;
}

function syncRouteSegments(viewer: Viewer, routes: Route[]): void {
  const desiredIds = new Set<string>();

  routes.forEach((route, routeIndex) => {
    const color = cssColorToCesium(ROUTE_COLORS[routeIndex % ROUTE_COLORS.length]!);

    route.segments.forEach((segment, segmentIndex) => {
      const id = segmentEntityId(route.id, segmentIndex);
      desiredIds.add(id);

      const positions = Cartesian3.fromDegreesArray(segmentPositions(segment));

      const existing = viewer.entities.getById(id);
      if (existing?.polyline) {
        existing.polyline.positions = new ConstantProperty(positions);
        existing.polyline.material = new ColorMaterialProperty(color);
      } else {
        viewer.entities.add({
          id,
          polyline: {
            positions,
            width: 3,
            material: color,
            arcType: ArcType.GEODESIC,
          },
        });
      }
    });
  });

  for (const entity of viewer.entities.values) {
    const id = entity.id;
    if (typeof id === "string" && isSegmentEntityId(id) && !desiredIds.has(id)) {
      viewer.entities.remove(entity);
    }
  }
}

function syncAirportMarkers(viewer: Viewer, airports: Airport[]): void {
  const desiredIds = new Set(airports.map(airportEntityId));

  for (const airport of airports) {
    const code = airport.iata || airport.icao;
    const id = airportEntityId(airport);
    const position = Cartesian3.fromDegrees(airport.lon, airport.lat);

    const existing = viewer.entities.getById(id);
    if (existing) {
      existing.position = new ConstantPositionProperty(position);
      if (existing.label) {
        existing.label.text = new ConstantProperty(code);
      }
      existing.description = new ConstantProperty(airportDescription(airport, code));
    } else {
      viewer.entities.add({
        id,
        position,
        point: {
          pixelSize: 12,
          color: Color.fromCssColorString("#2563eb"),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: code,
          font: "12px system-ui, sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -14),
        },
        description: airportDescription(airport, code),
      });
    }
  }

  for (const entity of viewer.entities.values) {
    const id = entity.id;
    if (typeof id === "string" && isAirportEntityId(id) && !desiredIds.has(id)) {
      viewer.entities.remove(entity);
    }
  }
}

export function CesiumView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const hasInitialFitRef = useRef(false);
  const prevRoutesRef = useRef<Route[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const routes = useRouteStore((state) => state.routes);
  const draftAirports = useRouteStore((state) => state.draftAirports);
  const projection = useMapStore((state) => state.projection);

  const airports = useMemo(
    () => allMapAirports({ routes, draftAirports }),
    [routes, draftAirports],
  );

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    let cancelled = false;

    void (async () => {
      try {
        const instance = await createCesiumViewer(containerRef.current!);
        if (cancelled) {
          instance.destroy();
          return;
        }

        applyMapProjection(instance, useMapStore.getState().projection);
        viewerRef.current = instance;
        setViewer(instance);
        setMapError(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setMapError(message);
      }
    })();

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
        setViewer(null);
      }
    };
  }, []);

  useEffect(() => {
    if (!viewer) return;
    applyMapProjection(viewer, projection);
  }, [viewer, projection]);

  useEffect(() => {
    if (!viewer || !containerRef.current) return;

    const container = containerRef.current;
    const onResize = () => {
      viewer.resize();
    };

    onResize();
    const observer = new ResizeObserver(onResize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;

    try {
      syncRouteSegments(viewer, routes);
      setMapError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMapError(message);
    }
  }, [viewer, routes]);

  useEffect(() => {
    if (!viewer) return;

    try {
      syncAirportMarkers(viewer, airports);
      setMapError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMapError(message);
    }
  }, [viewer, airports]);

  useEffect(() => {
    if (!viewer) return;

    const committedAirports = allMapAirports({ routes, draftAirports: [] });
    if (committedAirports.length < 2) return;

    if (!hasInitialFitRef.current) {
      fitCameraToAirports(viewer, committedAirports, "auto");
      hasInitialFitRef.current = true;
      prevRoutesRef.current = routes;
      return;
    }

    if (prevRoutesRef.current !== routes) {
      fitCameraToAirports(viewer, committedAirports, "auto");
      prevRoutesRef.current = routes;
    }
  }, [viewer, routes]);

  const handleHome = () => {
    if (viewerRef.current) flyHomeView(viewerRef.current, airports);
  };

  return (
    <div className="relative h-full w-full [&_.cesium-viewer-toolbar]:hidden [&_.cesium-viewer-bottom]:left-2 [&_.cesium-viewer-bottom]:right-auto">
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <ProjectionToggle />
        <RouteModeToggle />
      </div>
      <MapControls viewer={viewer} onHome={handleHome} />
      {mapError ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/90 p-6 text-center">
          <p className="max-w-md text-sm text-red-200">
            Map failed to load: {mapError}. Try restarting the dev server (
            <code className="text-red-100">pnpm dev</code>).
          </p>
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
