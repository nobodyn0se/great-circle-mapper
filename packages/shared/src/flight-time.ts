const KM_PER_NM = 1.852;
const MIN_BLOCK_MINUTES = 20;

type FlightTier = "short" | "medium" | "long";

/** Tier thresholds and block-time parameters (gate-to-gate, jet airliner). */
const TIER_PARAMS: Record<
  FlightTier,
  { overheadMinutes: number; blockSpeedKt: number; shortHopNmPerMin?: number }
> = {
  short: { overheadMinutes: 40, blockSpeedKt: 0, shortHopNmPerMin: 0.05 },
  medium: { overheadMinutes: 30, blockSpeedKt: 410 },
  long: { overheadMinutes: 28, blockSpeedKt: 468 },
};

function tierForDistanceNm(distanceNm: number): FlightTier {
  if (distanceNm < 300) return "short";
  if (distanceNm < 1500) return "medium";
  return "long";
}

/** Typical gate-to-gate block time from great-circle distance. */
export function estimateTypicalBlockMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return MIN_BLOCK_MINUTES;

  const distanceNm = distanceKm / KM_PER_NM;
  const tier = tierForDistanceNm(distanceNm);
  const params = TIER_PARAMS[tier];

  let minutes: number;
  if (tier === "short") {
    minutes = params.overheadMinutes + distanceNm * (params.shortHopNmPerMin ?? 0);
  } else {
    minutes = params.overheadMinutes + (distanceNm / params.blockSpeedKt) * 60;
  }

  return Math.max(Math.round(minutes), MIN_BLOCK_MINUTES);
}

export function formatFlightTime(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) {
    return `${total} min`;
  }
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}

export const FLIGHT_TIME_ASSUMPTIONS =
  "Typical gate-to-gate block time for a jet airliner. Based on great-circle distance and flight-length tier. Does not include layovers, winds, or airline-specific schedules.";
