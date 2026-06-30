import type { Airport, LatLon, NavGraph } from "@gcm/shared";

const NAV_GRAPH_URL = "/data/nav-graph.json.gz";
const MAX_SNAP_NM = 120;
const MAX_ASTAR_ITERATIONS = 80_000;

type FixCoord = { lat: number; lon: number };
type Adjacency = Map<string, Array<{ to: string; cost: number }>>;

let graph: NavGraph | null = null;
let fixCoords: Map<string, FixCoord> | null = null;
let adjacency: Adjacency | null = null;
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

function haversineNm(a: FixCoord, b: FixCoord): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return (2 * 6_371 / 1.852) * Math.asin(Math.sqrt(h));
}

function buildIndexes(data: NavGraph): void {
  fixCoords = new Map(data.fixes.map((fix) => [fix.id, { lat: fix.lat, lon: fix.lon }]));

  adjacency = new Map();
  for (const edge of data.edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push({ to: edge.to, cost: edge.distanceNm });
    adjacency.set(edge.from, list);
  }
}

async function fetchNavGraph(): Promise<NavGraph | null> {
  const parsed = await fetchGzJson<NavGraph>(NAV_GRAPH_URL);
  if (!parsed || !Array.isArray(parsed.fixes) || !Array.isArray(parsed.edges)) {
    return null;
  }
  return parsed;
}

/** Load nav-graph data when the pipeline artifact is present. */
export async function ensureNavGraphLoaded(): Promise<boolean> {
  if (graph) return true;
  if (!loadPromise) {
    loadPromise = fetchNavGraph();
  }
  const loaded = await loadPromise;
  if (loaded) {
    graph = loaded;
    buildIndexes(loaded);
    return true;
  }
  return false;
}

export function isNavGraphAvailable(): boolean {
  return graph !== null;
}

function snapToNearestFix(airport: Airport): string | null {
  if (!fixCoords) return null;

  let bestId: string | null = null;
  let bestDist = Infinity;
  const target = { lat: airport.lat, lon: airport.lon };

  for (const [id, coord] of fixCoords) {
    const dist = haversineNm(target, coord);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = id;
    }
  }

  return bestDist <= MAX_SNAP_NM ? bestId : null;
}

function reconstructPath(
  cameFrom: Map<string, string>,
  current: string,
  start: string,
  end: string,
): string[] {
  const nodes = [current];
  while (current !== start) {
    const prev = cameFrom.get(current);
    if (!prev) return [];
    current = prev;
    nodes.push(current);
  }
  nodes.reverse();

  if (nodes[0] !== start || nodes[nodes.length - 1] !== end) {
    return [];
  }

  return nodes.slice(1, -1);
}

function astar(start: string, goal: string): string[] | null {
  if (!adjacency || !fixCoords) return null;

  const startCoord = fixCoords.get(start);
  const goalCoord = fixCoords.get(goal);
  if (!startCoord || !goalCoord) return null;
  if (start === goal) return [];

  const open = new Set<string>([start]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[start, 0]]);
  const fScore = new Map<string, number>([[start, haversineNm(startCoord, goalCoord)]]);

  let iterations = 0;

  while (open.size > 0) {
    if (++iterations > MAX_ASTAR_ITERATIONS) return null;

    let current: string | null = null;
    let lowestF = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = id;
      }
    }

    if (!current) return null;
    if (current === goal) {
      return reconstructPath(cameFrom, current, start, goal);
    }

    open.delete(current);
    const currentG = gScore.get(current) ?? Infinity;

    for (const edge of adjacency.get(current) ?? []) {
      const tentativeG = currentG + edge.cost;
      const knownG = gScore.get(edge.to);

      if (knownG === undefined || tentativeG < knownG) {
        cameFrom.set(edge.to, current);
        gScore.set(edge.to, tentativeG);
        const neighborCoord = fixCoords.get(edge.to);
        if (!neighborCoord) continue;
        fScore.set(edge.to, tentativeG + haversineNm(neighborCoord, goalCoord));
        open.add(edge.to);
      }
    }
  }

  return null;
}

/**
 * Find an airway path between two airports.
 * Returns intermediate fixes only (endpoints excluded), or null to fall back to great-circle.
 */
export function findAirwayPath(from: Airport, to: Airport): LatLon[] | null {
  if (!graph || !fixCoords) return null;

  const startFix = snapToNearestFix(from);
  const endFix = snapToNearestFix(to);
  if (!startFix || !endFix) return null;

  const fixPath = astar(startFix, endFix);
  if (fixPath === null) return null;

  return fixPath
    .map((id) => fixCoords!.get(id))
    .filter((coord): coord is FixCoord => coord !== undefined)
    .map(({ lat, lon }) => ({ lat, lon }));
}
