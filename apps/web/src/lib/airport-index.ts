import type { CompactAirport, DataManifest } from "@gcm/shared";
import { compactToAirport } from "@gcm/shared";
import MiniSearch from "minisearch";

async function fetchGzJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

  // #region agent log
  fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'airport-index.ts:fetchGzJson',message:'fetch response inspected',data:{url,isGzip,byteLength:bytes.length,contentEncoding:response.headers.get('content-encoding')},timestamp:Date.now(),runId:'post-fix',hypothesisId:'H3'})}).catch(()=>{});
  // #endregion

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
}

type SearchDocument = {
  id: number;
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  keywords: string;
};

class AirportIndex {
  private airports: CompactAirport[] = [];
  private byCode = new Map<string, number>();
  private miniSearch: MiniSearch<SearchDocument> | null = null;
  private manifest: DataManifest | null = null;

  get isLoaded(): boolean {
    return this.miniSearch !== null;
  }

  getManifest(): DataManifest | null {
    return this.manifest;
  }

  async load(): Promise<void> {
    if (this.isLoaded) return;

    const manifestResponse = await fetch("/data/manifest.json");
    if (!manifestResponse.ok) {
      throw new Error("Failed to load manifest.json");
    }
    this.manifest = (await manifestResponse.json()) as DataManifest;

    const [airports, byCodeRecord] = await Promise.all([
      fetchGzJson<CompactAirport[]>(`/data/${this.manifest.files.search}`),
      fetchGzJson<Record<string, number>>(`/data/${this.manifest.files.byCode}`),
    ]);

    this.airports = airports;
    this.byCode = new Map(Object.entries(byCodeRecord));
    // #region agent log
    fetch('http://127.0.0.1:7806/ingest/2e95b606-e272-4bbe-93c9-63d324d43a18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d29f80'},body:JSON.stringify({sessionId:'d29f80',location:'airport-index.ts:load',message:'index loaded',data:{airportCount:airports.length,byCodeSize:this.byCode.size,jfk:this.byCode.has('JFK'),lhr:this.byCode.has('LHR'),dxb:this.byCode.has('DXB')},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion

    const documents: SearchDocument[] = airports.map((row, id) => ({
      id,
      iata: row[2],
      icao: row[3],
      name: row[4],
      city: row[5],
      country: row[6],
      keywords: `${row[2]} ${row[3]} ${row[4]} ${row[5]} ${row[6]}`,
    }));

    this.miniSearch = new MiniSearch({
      fields: ["iata", "icao", "name", "city", "country", "keywords"],
      storeFields: ["id"],
      searchOptions: {
        boost: { iata: 3, icao: 3, name: 2, city: 1.5 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
    this.miniSearch.addAll(documents);
  }

  resolveCode(code: string) {
    const normalized = code.trim().toUpperCase();
    const index = this.byCode.get(normalized);
    if (index === undefined) return null;
    const row = this.airports[index];
    return row ? compactToAirport(row) : null;
  }

  resolveCodes(codes: string[]) {
    const resolved = [];
    const unknown: string[] = [];

    for (const code of codes) {
      const airport = this.resolveCode(code);
      if (airport) resolved.push(airport);
      else unknown.push(code);
    }

    return { resolved, unknown };
  }

  searchAirports(query: string, limit = 10) {
    if (!this.miniSearch) return [];

    const normalized = query.trim().toUpperCase();
    if (normalized.length >= 3) {
      const exact = this.resolveCode(normalized);
      if (exact) return [exact];
    }

    const results = this.miniSearch.search(query).slice(0, limit);
    return results
      .map((result) => {
        const row = this.airports[result.id];
        return row ? compactToAirport(row) : null;
      })
      .filter((airport): airport is NonNullable<typeof airport> => airport !== null);
  }
}

export const airportIndex = new AirportIndex();
