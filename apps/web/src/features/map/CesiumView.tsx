import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  LabelStyle,
  VerticalOrigin,
  type Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { ROUTE_COLORS } from "@/lib/route-engine";
import { allMapAirports, useRouteStore } from "@/stores/route-store";
import { useMapStore } from "@/stores/map-store";
import { ProjectionToggle } from "@/features/map/ProjectionToggle";
import { MapControls, flyHomeView } from "@/features/map/MapControls";
import {
  applyMapProjection,
  createCesiumViewer,
  cssColorToCesium,
  fitCameraToAirports,
} from "@/features/map/cesium-config";

export function CesiumView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
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
      // #region agent log
      fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'CesiumView.tsx:resize',message:'viewer resized',data:{width:container.clientWidth,height:container.clientHeight},timestamp:Date.now(),runId:'post-fix',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
    };

    onResize();
    const observer = new ResizeObserver(onResize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;

    try {
      viewer.entities.removeAll();

      routes.forEach((route, routeIndex) => {
        const color = cssColorToCesium(ROUTE_COLORS[routeIndex % ROUTE_COLORS.length]!);

        route.segments.forEach((segment, segmentIndex) => {
          viewer.entities.add({
            id: `route-${route.id}-${segmentIndex}`,
            polyline: {
              positions: Cartesian3.fromDegreesArray([
                segment.from.lon,
                segment.from.lat,
                segment.to.lon,
                segment.to.lat,
              ]),
              width: 3,
              material: color,
              arcType: ArcType.GEODESIC,
            },
          });
        });
      });

      airports.forEach((airport) => {
        const code = airport.iata || airport.icao;
        viewer.entities.add({
          id: `airport-${code}-${airport.icao}`,
          position: Cartesian3.fromDegrees(airport.lon, airport.lat),
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
          description: `<strong>${code}</strong><br/>${airport.name}<br/><span style="opacity:.75">${airport.city}, ${airport.country}</span>`,
        });
      });

      if (airports.length >= 2) {
        fitCameraToAirports(viewer, airports, "auto");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMapError(message);
      // #region agent log
      fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'CesiumView.tsx:entities',message:'entity update failed',data:{error:message,airportCount:airports.length},timestamp:Date.now(),runId:'post-fix-v2',hypothesisId:'H7'})}).catch(()=>{});
      // #endregion
    }
  }, [viewer, routes, airports]);

  const handleHome = () => {
    if (viewerRef.current) flyHomeView(viewerRef.current, airports);
  };

  return (
    <div className="relative h-full w-full [&_.cesium-viewer-toolbar]:hidden [&_.cesium-viewer-bottom]:left-2 [&_.cesium-viewer-bottom]:right-auto">
      <ProjectionToggle />
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
