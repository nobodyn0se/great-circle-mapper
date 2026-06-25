import { useState, type FormEvent } from "react";
import { useRouteStore } from "@/stores/route-store";

export function RouteInput() {
  const [rawInput, setRawInput] = useState("");
  const ensureDataLoaded = useRouteStore((state) => state.ensureDataLoaded);
  const loadRoutesFromCodes = useRouteStore((state) => state.loadRoutesFromCodes);
  const clearDraft = useRouteStore((state) => state.clearDraft);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    await ensureDataLoaded();

    const routeCodes = trimmed
      .split(/[,;]/)
      .map((route) =>
        route
          .split("-")
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
      )
      .filter((route) => route.length >= 2);

    if (routeCodes.length === 0) return;

    loadRoutesFromCodes(routeCodes, { append: true });
    clearDraft();
    setRawInput("");
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-2">
      <label htmlFor="raw-route" className="block text-sm font-medium text-slate-300">
        Raw route input
      </label>
      <input
        id="raw-route"
        value={rawInput}
        onChange={(event) => setRawInput(event.target.value)}
        placeholder="JFK-LHR-DXB or JFK-LHR,SFO-NRT"
        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-sm text-white outline-none ring-blue-500 focus:ring-2"
      />
      <button
        type="submit"
        className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
      >
        Map route
      </button>
    </form>
  );
}
