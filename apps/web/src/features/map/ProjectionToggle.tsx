import type { MapProjection } from "@/stores/map-store";
import { useMapStore } from "@/stores/map-store";

const MODES: { value: MapProjection; label: string }[] = [
  { value: "globe", label: "Globe" },
  { value: "mercator", label: "Flat" },
];

export function ProjectionToggle() {
  const projection = useMapStore((state) => state.projection);
  const setProjection = useMapStore((state) => state.setProjection);

  return (
    <div
      className="flex rounded-lg border border-slate-600/80 bg-slate-900/90 p-0.5 shadow-lg backdrop-blur-sm"
      role="group"
      aria-label="Map projection"
    >
      {MODES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={projection === value}
          onClick={() => setProjection(value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            projection === value
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
