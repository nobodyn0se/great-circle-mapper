import { create } from "zustand";
import type { Airport, DistanceUnit, Route } from "@gcm/shared";
import { buildRoute } from "@/lib/route-engine";
import { readRoutesFromUrl, readUnitsFromUrl, syncUrl } from "@/lib/url-routes";
import { airportIndex } from "@/lib/airport-index";

type AppState = {
  routes: Route[];
  draftAirports: Airport[];
  units: DistanceUnit;
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
  loadRoutesFromCodes: (routeCodes: string[][]) => void;
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
    const { draftAirports, routes, units } = get();
    if (draftAirports.length < 2) return;

    const route = buildRoute(draftAirports);
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

  loadRoutesFromCodes: (routeCodes) => {
    const unknown: string[] = [];
    const routes: Route[] = [];

    for (const codes of routeCodes) {
      const { resolved, unknown: missing } = airportIndex.resolveCodes(codes);
      unknown.push(...missing);
      if (resolved.length >= 2) {
        routes.push(buildRoute(resolved));
      }
    }

    set({ routes, unknownCodes: unknown });
    syncUrl(routes, get().units);
  },

  initFromUrl: async () => {
    const routeCodes = readRoutesFromUrl();
    if (routeCodes.length === 0) return;

    await get().ensureDataLoaded();
    if (get().dataReady) {
      get().loadRoutesFromCodes(routeCodes);
    }
  },
}));

export function allMapAirports(state: Pick<AppState, "routes" | "draftAirports">): Airport[] {
  const fromRoutes = state.routes.flatMap((route) => route.airports);
  return uniqueAirports([...fromRoutes, ...state.draftAirports]);
}
