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
    // #region agent log
    fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'route-store.ts:ensureDataLoaded:entry',message:'ensureDataLoaded called',data:{dataReady:get().dataReady,dataLoading:get().dataLoading,indexLoaded:airportIndex.isLoaded},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    if (get().dataReady || get().dataLoading) return;
    set({ dataLoading: true, dataError: null });
    try {
      await airportIndex.load();
      set({ dataReady: true, dataLoading: false });
      // #region agent log
      fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'route-store.ts:ensureDataLoaded:success',message:'data load complete',data:{dataReady:true,indexLoaded:airportIndex.isLoaded},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'route-store.ts:ensureDataLoaded:error',message:'data load failed',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'route-store.ts:loadRoutesFromCodes',message:'resolving route codes',data:{routeCodes,indexLoaded:airportIndex.isLoaded,dataReady:get().dataReady,dataLoading:get().dataLoading},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    const unknown: string[] = [];
    const routes: Route[] = [];

    for (const codes of routeCodes) {
      const { resolved, unknown: missing } = airportIndex.resolveCodes(codes);
      // #region agent log
      fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'route-store.ts:loadRoutesFromCodes:result',message:'resolve result',data:{codes,resolvedCount:resolved.length,missing,resolvedCodes:resolved.map(a=>a.iata||a.icao)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'route-store.ts:initFromUrl',message:'init from URL',data:{routeCodes,search:typeof window!=='undefined'?window.location.search:''},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    if (routeCodes.length === 0) return;

    await get().ensureDataLoaded();
    // #region agent log
    fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'route-store.ts:initFromUrl:afterEnsure',message:'after ensureDataLoaded',data:{dataReady:get().dataReady,dataLoading:get().dataLoading,indexLoaded:airportIndex.isLoaded},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    if (get().dataReady) {
      get().loadRoutesFromCodes(routeCodes);
    }
  },
}));

export function allMapAirports(state: Pick<AppState, "routes" | "draftAirports">): Airport[] {
  const fromRoutes = state.routes.flatMap((route) => route.airports);
  return uniqueAirports([...fromRoutes, ...state.draftAirports]);
}
