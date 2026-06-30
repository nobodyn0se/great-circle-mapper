import type { RouteMode } from "@gcm/shared";
import { useRouteStore } from "@/stores/route-store";

const MODES: { value: RouteMode; label: string }[] = [
  { value: "great-circle", label: "Great circle" },
  { value: "airway", label: "Airways" },
];

export function RouteModeToggle() {
  const routeMode = useRouteStore((state) => state.routeMode);
  const setRouteMode = useRouteStore((state) => state.setRouteMode);

  return (
    <div
      className="flex rounded-lg border border-slate-600/80 bg-slate-900/90 p-0.5 shadow-lg backdrop-blur-sm"
      role="group"
      aria-label="Route calculation mode"
    >
      {MODES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={routeMode === value}
          title={
            value === "airway"
              ? "Route along published airways when nav data is available; otherwise great-circle"
              : "Direct great-circle distance between airports"
          }
          onClick={() => setRouteMode(value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            routeMode === value
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
