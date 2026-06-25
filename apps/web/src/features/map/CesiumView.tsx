import { useEffect, useMemo, useRef } from "react";
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
import { applyMapProjection, createCesiumViewer, cssColorToCesium } from "@/features/map/cesium-config";

export function CesiumView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  const routes = useRouteStore((state) => state.routes);
  const draftAirports = useRouteStore((state) => state.draftAirports);
  const projection = useMapStore((state) => state.projection);

  const airports = useMemo(
    () => allMapAirports({ routes, draftAirports }),
    [routes, draftAirports],
  );

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = createCesiumViewer(containerRef.current);
    applyMapProjection(viewer, useMapStore.getState().projection);
    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    applyMapProjection(viewer, projection);
  }, [projection]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

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
      void viewer.zoomTo(viewer.entities);
    }
  }, [routes, airports]);

  return (
    <div className="relative h-full w-full">
      <ProjectionToggle />
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
