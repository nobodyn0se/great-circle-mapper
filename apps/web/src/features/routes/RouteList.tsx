import { formatDistance } from "@gcm/shared";
import { useRouteStore } from "@/stores/route-store";

export function RouteList() {
  const routes = useRouteStore((state) => state.routes);
  const units = useRouteStore((state) => state.units);
  const setUnits = useRouteStore((state) => state.setUnits);
  const removeRoute = useRouteStore((state) => state.removeRoute);

  if (routes.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Add airports via search or paste a route like <code className="text-slate-200">JFK-LHR-DXB</code>.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Routes</h2>
        <select
          value={units}
          onChange={(event) => setUnits(event.target.value as typeof units)}
          className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
        >
          <option value="nm">Nautical miles</option>
          <option value="km">Kilometers</option>
          <option value="mi">Miles</option>
        </select>
      </div>

      {routes.map((route, routeIndex) => (
        <article
          key={route.id}
          className="rounded-lg border border-slate-700 bg-slate-800/60 p-3"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Route {routeIndex + 1}
              </p>
              <p className="font-mono text-sm text-white">
                {route.airports.map((airport) => airport.iata || airport.icao).join(" → ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeRoute(route.id)}
              className="text-xs text-slate-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>

          <ul className="space-y-1 text-sm text-slate-300">
            {route.segments.map((segment) => {
              const from = segment.from.iata || segment.from.icao;
              const to = segment.to.iata || segment.to.icao;
              return (
                <li key={`${from}-${to}`} className="flex justify-between gap-4">
                  <span>
                    {from} – {to}
                  </span>
                  <span className="font-mono text-slate-200">
                    {formatDistance(segment.distanceKm, units)}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex justify-between border-t border-slate-700 pt-2 text-sm font-medium text-white">
            <span>Total</span>
            <span className="font-mono">{formatDistance(route.totalKm, units)}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
