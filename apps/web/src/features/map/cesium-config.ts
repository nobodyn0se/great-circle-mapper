import {
  BoundingSphere,
  Cartesian3,
  Cartographic,
  Color,
  createWorldImageryAsync,
  HeadingPitchRange,
  ImageryLayer,
  Ion,
  IonWorldImageryStyle,
  Math as CesiumMath,
  SceneMode,
  SceneTransforms,
  UrlTemplateImageryProvider,
  Viewer,
  type Viewer as CesiumViewer,
} from "cesium";
import type { MapProjection } from "@/stores/map-store";

export type CameraFitAirport = { lat: number; lon: number };

export function cameraSnapshot(viewer: CesiumViewer) {
  const c = viewer.camera.positionCartographic;
  return {
    lat: CesiumMath.toDegrees(c.latitude),
    lon: CesiumMath.toDegrees(c.longitude),
    height: c.height,
    pitch: CesiumMath.toDegrees(viewer.camera.pitch),
    heading: CesiumMath.toDegrees(viewer.camera.heading),
  };
}

export function airportBoundsSnapshot(airports: CameraFitAirport[]) {
  if (airports.length === 0) return null;
  const bs = BoundingSphere.fromPoints(
    airports.map((airport) => Cartesian3.fromDegrees(airport.lon, airport.lat)),
  );
  const carto = Cartographic.fromCartesian(bs.center);
  return {
    radius: bs.radius,
    centerLat: CesiumMath.toDegrees(carto.latitude),
    centerLon: CesiumMath.toDegrees(carto.longitude),
  };
}

export function screenTargetOffset(viewer: CesiumViewer, target: Cartesian3) {
  const canvas = viewer.scene.canvas;
  const windowPos = SceneTransforms.worldToWindowCoordinates(viewer.scene, target);
  if (!windowPos) return null;
  return {
    canvasW: canvas.clientWidth,
    canvasH: canvas.clientHeight,
    targetX: windowPos.x,
    targetY: windowPos.y,
    offsetX: windowPos.x - canvas.clientWidth / 2,
    offsetY: windowPos.y - canvas.clientHeight / 2,
  };
}

const TOP_DOWN_PITCH = -CesiumMath.PI_OVER_TWO + CesiumMath.toRadians(0.1);

export function fitCameraToAirports(
  viewer: CesiumViewer,
  airports: CameraFitAirport[],
  source: "auto" | "home",
): void {
  if (airports.length === 0) return;

  const boundingSphere = BoundingSphere.fromPoints(
    airports.map((airport) => Cartesian3.fromDegrees(airport.lon, airport.lat)),
  );
  if (boundingSphere.radius < 1000) {
    boundingSphere.radius = 250_000;
  }

  const before = cameraSnapshot(viewer);
  const airportBounds = airportBoundsSnapshot(airports);
  const screenBefore = screenTargetOffset(viewer, boundingSphere.center);
  // #region agent log
  fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'cesium-config.ts:fitCameraToAirports',message:'fit before',data:{source,airportCount:airports.length,before,airportBounds,screenBefore,pitchOffsetDeg:-89.9},timestamp:Date.now(),runId:'camera-center-v3',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  viewer.camera.cancelFlight();
  viewer.camera.flyToBoundingSphere(boundingSphere, {
    duration: source === "home" ? 1 : 0.8,
    offset: new HeadingPitchRange(0, TOP_DOWN_PITCH, 0),
    complete: () => {
      const after = cameraSnapshot(viewer);
      const screenAfter = screenTargetOffset(viewer, boundingSphere.center);
      // #region agent log
      fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'cesium-config.ts:fitCameraToAirports',message:'fit after',data:{source,after,screenAfter,pitchDelta:after.pitch-before.pitch,screenOffsetYDelta:screenAfter&&screenBefore?screenAfter.offsetY-screenBefore.offsetY:null},timestamp:Date.now(),runId:'camera-center-v3',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
    },
  });
}

const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim();

/** Carto Voyager — labeled streets, no API key required. */
function createFallbackImageryLayer(): ImageryLayer {
  return new ImageryLayer(
    new UrlTemplateImageryProvider({
      url: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      credit: "© OpenStreetMap contributors © CARTO",
      maximumLevel: 19,
    }),
  );
}

export function getDefaultBasemapName(): string {
  return ION_TOKEN ? "Cesium Ion (Road)" : "CARTO Voyager";
}

async function resolveDefaultImageryLayer(): Promise<ImageryLayer> {
  if (ION_TOKEN) {
    Ion.defaultAccessToken = ION_TOKEN;
    try {
      const provider = await createWorldImageryAsync({
        style: IonWorldImageryStyle.ROAD,
      });
      return new ImageryLayer(provider);
    } catch (error) {
      console.warn("Cesium Ion imagery unavailable, using fallback basemap.", error);
    }
  }

  return createFallbackImageryLayer();
}

function configureCameraController(viewer: CesiumViewer): void {
  const controller = viewer.scene.screenSpaceCameraController;

  controller.enableRotate = true;
  controller.enableTranslate = true;
  controller.enableZoom = true;
  controller.enableTilt = true;
  controller.enableLook = true;
  controller.minimumZoomDistance = 500;
  controller.maximumZoomDistance = 40_000_000;
  controller.inertiaSpin = 0.9;
  controller.inertiaTranslate = 0.9;
  controller.inertiaZoom = 0.8;
}

export async function createCesiumViewer(container: HTMLElement): Promise<CesiumViewer> {
  try {
    const baseLayer = await resolveDefaultImageryLayer();

    const viewer = new Viewer(container, {
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      vrButton: false,
      infoBox: true,
      selectionIndicator: true,
      baseLayer,
    });

    configureCameraController(viewer);
    // #region agent log
    fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'cesium-config.ts:createCesiumViewer',message:'viewer created',data:{cesiumBaseUrl:typeof CESIUM_BASE_URL!=='undefined'?CESIUM_BASE_URL:'missing'},timestamp:Date.now(),runId:'post-fix-v2',hypothesisId:'H7'})}).catch(()=>{});
    // #endregion
    return viewer;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'cesium-config.ts:createCesiumViewer',message:'viewer create failed',data:{error:String(error)},timestamp:Date.now(),runId:'post-fix-v2',hypothesisId:'H7'})}).catch(()=>{});
    // #endregion
    throw error;
  }
}

export function applyMapProjection(viewer: CesiumViewer, projection: MapProjection): void {
  if (projection === "globe") {
    if (viewer.scene.mode !== SceneMode.SCENE3D) {
      viewer.scene.morphTo3D(0.5);
    }
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }
  } else {
    if (viewer.scene.mode !== SceneMode.SCENE2D) {
      viewer.scene.morphTo2D(0.5);
    }
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = false;
    }
  }
}

export function cssColorToCesium(hex: string): Color {
  return Color.fromCssColorString(hex);
}
