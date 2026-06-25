import { create } from "zustand";

export type MapProjection = "globe" | "mercator";

const STORAGE_KEY = "gcm-map-projection";

function readProjection(): MapProjection {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "globe" || stored === "mercator") return stored;
  } catch {
    // localStorage unavailable
  }
  return "globe";
}

type MapState = {
  projection: MapProjection;
  setProjection: (projection: MapProjection) => void;
};

export const useMapStore = create<MapState>((set) => ({
  projection: readProjection(),
  setProjection: (projection) => {
    try {
      localStorage.setItem(STORAGE_KEY, projection);
    } catch {
      // localStorage unavailable
    }
    set({ projection });
  },
}));
