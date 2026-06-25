import {
  BoundingSphere,
  Cartesian3,
  Color,
  createWorldImageryAsync,
  HeadingPitchRange,
  ImageryLayer,
  Ion,
  IonWorldImageryStyle,
  Math as CesiumMath,
  SceneMode,
  UrlTemplateImageryProvider,
  Viewer,
  type Viewer as CesiumViewer,
} from "cesium";
import type { MapProjection } from "@/stores/map-store";

export type CameraFitAirport = { lat: number; lon: number };

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

  viewer.camera.cancelFlight();
  viewer.camera.flyToBoundingSphere(boundingSphere, {
    duration: source === "home" ? 1 : 0.8,
    offset: new HeadingPitchRange(0, TOP_DOWN_PITCH, 0),
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
  return viewer;
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
