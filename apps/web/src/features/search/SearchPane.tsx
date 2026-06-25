import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Airport } from "@gcm/shared";
import { airportIndex } from "@/lib/airport-index";
import { useRouteStore } from "@/stores/route-store";

export function SearchPane() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const ensureDataLoaded = useRouteStore((state) => state.ensureDataLoaded);
  const dataReady = useRouteStore((state) => state.dataReady);
  const dataLoading = useRouteStore((state) => state.dataLoading);
  const addToDraft = useRouteStore((state) => state.addToDraft);
  const commitDraft = useRouteStore((state) => state.commitDraft);
  const draftAirports = useRouteStore((state) => state.draftAirports);
  const removeFromDraft = useRouteStore((state) => state.removeFromDraft);

  const runSearch = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setResults([]);
        return;
      }

      await ensureDataLoaded();
      if (!airportIndex.isLoaded) return;

      const currentRequest = ++requestId.current;
      setLoading(true);
      const matches = airportIndex.searchAirports(trimmed);
      if (currentRequest === requestId.current) {
        setResults(matches);
        setLoading(false);
      }
    },
    [ensureDataLoaded],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch(query);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  const handleSelect = (airport: Airport) => {
    addToDraft(airport);
    setQuery("");
    setResults([]);
  };

  const statusText = useMemo(() => {
    if (dataLoading) return "Loading airport database…";
    if (!dataReady && query) return "Preparing search index…";
    if (loading) return "Searching…";
    if (query && results.length === 0 && dataReady) return "No airports found";
    return null;
  }, [dataLoading, dataReady, loading, query, results.length]);

  return (
    <section className="space-y-3">
      <div>
        <label htmlFor="airport-search" className="mb-1 block text-sm font-medium text-slate-300">
          Search airports
        </label>
        <input
          id="airport-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => void ensureDataLoaded()}
          placeholder="IATA, ICAO, city, or name"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-blue-500 focus:ring-2"
        />
        {statusText ? <p className="mt-1 text-xs text-slate-400">{statusText}</p> : null}
      </div>

      {results.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/80">
          {results.map((airport) => {
            const code = airport.iata || airport.icao;
            return (
              <li key={`${code}-${airport.name}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(airport)}
                  className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-slate-700"
                >
                  <span className="min-w-12 font-mono font-semibold text-blue-300">{code}</span>
                  <span>
                    <span className="block text-slate-100">{airport.name}</span>
                    <span className="block text-xs text-slate-400">
                      {[airport.city, airport.country].filter(Boolean).join(", ")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {draftAirports.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-300">Current route</p>
          <div className="flex flex-wrap gap-2">
            {draftAirports.map((airport, index) => (
              <span
                key={`${airport.iata}-${airport.icao}-${index}`}
                className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-sm text-blue-100"
              >
                {airport.iata || airport.icao}
                <button
                  type="button"
                  aria-label={`Remove ${airport.iata || airport.icao}`}
                  onClick={() => removeFromDraft(index)}
                  className="text-blue-200 hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            disabled={draftAirports.length < 2}
            onClick={commitDraft}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add route to map
          </button>
        </div>
      ) : null}
    </section>
  );
}
