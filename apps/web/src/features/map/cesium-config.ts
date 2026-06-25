import {
  Color,
  ImageryLayer,
  SceneMode,
  UrlTemplateImageryProvider,
  Viewer,
  type Viewer as CesiumViewer,
} from "cesium";
import type { MapProjection } from "@/stores/map-store";

const OSM_IMAGERY = new ImageryLayer(
  new UrlTemplateImageryProvider({
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    credit: "OpenStreetMap contributors",
    maximumLevel: 19,
  }),
);

export function createCesiumViewer(container: HTMLElement): CesiumViewer {
  return new Viewer(container, {
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: true,
    sceneModePicker: false,
    navigationHelpButton: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    infoBox: true,
    selectionIndicator: true,
    baseLayer: OSM_IMAGERY,
  });
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
