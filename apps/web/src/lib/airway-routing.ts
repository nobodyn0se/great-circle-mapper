import type { Airport, LatLon } from "@gcm/shared";

/** Nav-graph artifact produced by the future CIFP data pipeline. */
type NavGraph = {
  fixes: Array<{ id: string; lat: number; lon: number }>;
  edges: Array<{ from: string; to: string; distanceNm: number }>;
};

const NAV_GRAPH_URL = "/data/nav-graph.json.gz";

let graph: NavGraph | null = null;
let loadPromise: Promise<NavGraph | null> | null = null;

async function fetchGzJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

    let text: string;
    if (isGzip) {
      const ds = new DecompressionStream("gzip");
      const decompressed = await new Response(
        new Blob([buffer]).stream().pipeThrough(ds),
      ).arrayBuffer();
      text = new TextDecoder().decode(decompressed);
    } else {
      text = new TextDecoder().decode(buffer);
    }

    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function fetchNavGraph(): Promise<NavGraph | null> {
  const parsed = await fetchGzJson<NavGraph>(NAV_GRAPH_URL);
  if (!parsed || !Array.isArray(parsed.fixes) || !Array.isArray(parsed.edges)) {
    return null;
  }
  return parsed;
}

/** Load nav-graph data when the airway pipeline artifact is present. */
export async function ensureNavGraphLoaded(): Promise<boolean> {
  if (graph) return true;
  if (!loadPromise) {
    loadPromise = fetchNavGraph();
  }
  graph = await loadPromise;
  return graph !== null;
}

export function isNavGraphAvailable(): boolean {
  return graph !== null;
}

/**
 * Find an airway path between two airports.
 * Returns intermediate fixes only (endpoints excluded), or null to fall back to great-circle.
 *
 * TODO: snap endpoints to nearest terminal fixes, run A* on `graph.edges`.
 */
export function findAirwayPath(from: Airport, to: Airport): LatLon[] | null {
  if (!graph) return null;
  void from;
  void to;
  return null;
}
