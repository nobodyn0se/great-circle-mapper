import { lazy, Suspense, useEffect } from "react";
import { RouteInput } from "@/features/routes/RouteInput";
import { RouteList } from "@/features/routes/RouteList";
import { SearchPane } from "@/features/search/SearchPane";
import { useRouteStore } from "@/stores/route-store";

const CesiumView = lazy(() =>
  import("@/features/map/CesiumView").then((module) => ({ default: module.CesiumView })),
);

export function App() {
  const initFromUrl = useRouteStore((state) => state.initFromUrl);
  const dataError = useRouteStore((state) => state.dataError);
  const unknownCodes = useRouteStore((state) => state.unknownCodes);

  useEffect(() => {
    void initFromUrl();
  }, [initFromUrl]);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-slate-700 bg-slate-900 p-4 lg:h-full lg:w-[380px] lg:border-r lg:border-b-0">
        <header>
          <h1 className="text-xl font-semibold text-white">Great Circle Mapper</h1>
          <p className="mt-1 text-sm text-slate-400">
            Plan multi-leg routes with great-circle distances.
          </p>
        </header>

        <RouteInput />
        <SearchPane />
        <RouteList />

        {dataError ? (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {dataError}
          </p>
        ) : null}

        {unknownCodes.length > 0 ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Unknown airports: {unknownCodes.join(", ")}
          </p>
        ) : null}
      </aside>

      <main className="relative min-h-[320px] flex-1 lg:min-h-0">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center bg-slate-950 text-slate-400">
              Loading map…
            </div>
          }
        >
          <CesiumView />
        </Suspense>
      </main>
    </div>
  );
}
