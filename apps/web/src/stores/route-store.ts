import { create } from "zustand";
import type { Airport, DistanceUnit, Route, RouteMode } from "@gcm/shared";
import { buildRoute } from "@/lib/route-engine";
import { ensureNavGraphLoaded } from "@/lib/airway-routing";
import { readRoutesFromUrl, readUnitsFromUrl, syncUrl } from "@/lib/url-routes";
import { airportIndex } from "@/lib/airport-index";

const ROUTE_MODE_KEY = "gcm-route-mode";

function readRouteMode(): RouteMode {
  try {
    const stored = localStorage.getItem(ROUTE_MODE_KEY);
    if (stored === "great-circle" || stored === "airway") return stored;
  } catch {
    // localStorage unavailable
  }
  return "great-circle";
}

function rebuildRoutes(routes: Route[], mode: RouteMode): Route[] {
  return routes.map((route) => buildRoute(route.airports, route.id, mode));
}

type AppState = {
  routes: Route[];
  draftAirports: Airport[];
  units: DistanceUnit;
  routeMode: RouteMode;
  unknownCodes: string[];
  dataReady: boolean;
  dataLoading: boolean;
  dataError: string | null;
  ensureDataLoaded: () => Promise<void>;
  addToDraft: (airport: Airport) => void;
  removeFromDraft: (index: number) => void;
  clearDraft: () => void;
  commitDraft: () => void;
  removeRoute: (id: string) => void;
  setUnits: (units: DistanceUnit) => void;
  setRouteMode: (mode: RouteMode) => void;
  loadRoutesFromCodes: (routeCodes: string[][], options?: { append?: boolean }) => void;
  initFromUrl: () => Promise<void>;
};

function uniqueAirports(airports: Airport[]): Airport[] {
  const seen = new Set<string>();
  return airports.filter((airport) => {
    const key = airport.iata || airport.icao || airport.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const useRouteStore = create<AppState>((set, get) => ({
  routes: [],
  draftAirports: [],
  units: readUnitsFromUrl(),
  routeMode: readRouteMode(),
  unknownCodes: [],
  dataReady: false,
  dataLoading: false,
  dataError: null,

  ensureDataLoaded: async () => {
    if (get().dataReady || get().dataLoading) return;
    set({ dataLoading: true, dataError: null });
    try {
      await airportIndex.load();
      set({ dataReady: true, dataLoading: false });
    } catch (error) {
      set({
        dataLoading: false,
        dataError: error instanceof Error ? error.message : "Failed to load airport data",
      });
    }
  },

  addToDraft: (airport) => {
    set((state) => {
      const last = state.draftAirports.at(-1);
      if (last && (last.iata === airport.iata || last.icao === airport.icao)) {
        return state;
      }
      return { draftAirports: [...state.draftAirports, airport] };
    });
  },

  removeFromDraft: (index) => {
    set((state) => ({
      draftAirports: state.draftAirports.filter((_, i) => i !== index),
    }));
  },

  clearDraft: () => set({ draftAirports: [] }),

  commitDraft: () => {
    const { draftAirports, routes, units, routeMode } = get();
    if (draftAirports.length < 2) return;

    const route = buildRoute(draftAirports, undefined, routeMode);
    const nextRoutes = [...routes, route];
    set({ routes: nextRoutes, draftAirports: [] });
    syncUrl(nextRoutes, units);
  },

  removeRoute: (id) => {
    set((state) => {
      const nextRoutes = state.routes.filter((route) => route.id !== id);
      syncUrl(nextRoutes, state.units);
      return { routes: nextRoutes };
    });
  },

  setUnits: (units) => {
    set({ units });
    syncUrl(get().routes, units);
  },

  setRouteMode: (mode) => {
    if (get().routeMode === mode) return;

    try {
      localStorage.setItem(ROUTE_MODE_KEY, mode);
    } catch {
      // localStorage unavailable
    }

    const applyMode = () => {
      const { routes } = get();
      set({ routeMode: mode, routes: rebuildRoutes(routes, mode) });
    };

    if (mode === "airway") {
      void ensureNavGraphLoaded().finally(applyMode);
      return;
    }

    applyMode();
  },

  loadRoutesFromCodes: (routeCodes, options?: { append?: boolean }) => {
    const existingRoutes = get().routes;
    const routeMode = get().routeMode;
    const unknown: string[] = [];
    const newRoutes: Route[] = [];

    for (const codes of routeCodes) {
      const { resolved, unknown: missing } = airportIndex.resolveCodes(codes);
      unknown.push(...missing);
      if (resolved.length >= 2) {
        newRoutes.push(buildRoute(resolved, undefined, routeMode));
      }
    }

    const nextRoutes = options?.append
      ? [...existingRoutes, ...newRoutes]
      : newRoutes;

    set({ routes: nextRoutes, unknownCodes: unknown });
    syncUrl(nextRoutes, get().units);
  },

  initFromUrl: async () => {
    const routeCodes = readRoutesFromUrl();
    if (routeCodes.length === 0) return;

    await get().ensureDataLoaded();
    if (get().dataReady) {
      get().loadRoutesFromCodes(routeCodes);
    }

    if (get().routeMode === "airway") {
      const loaded = await ensureNavGraphLoaded();
      if (loaded) {
        const { routes, routeMode } = get();
        if (routes.length > 0) {
          set({ routes: rebuildRoutes(routes, routeMode) });
        }
      }
    }
  },
}));

export function allMapAirports(state: Pick<AppState, "routes" | "draftAirports">): Airport[] {
  const fromRoutes = state.routes.flatMap((route) => route.airports);
  return uniqueAirports([...fromRoutes, ...state.draftAirports]);
}
