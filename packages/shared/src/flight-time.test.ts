import { describe, expect, it } from "vitest";
import { estimateTypicalBlockMinutes, formatFlightTime } from "./flight-time";

/** Great-circle distance approximations for calibration (km). */
const BOM_GOI_KM = 430;
const BOM_MRU_KM = 4750;
const JFK_LHR_KM = 5570;

describe("estimateTypicalBlockMinutes", () => {
  it("estimates BOM–GOI in the 45–60 min range", () => {
    const minutes = estimateTypicalBlockMinutes(BOM_GOI_KM);
    expect(minutes).toBeGreaterThanOrEqual(45);
    expect(minutes).toBeLessThanOrEqual(60);
  });

  it("estimates BOM–MRU in the 5h–6h range", () => {
    const minutes = estimateTypicalBlockMinutes(BOM_MRU_KM);
    expect(minutes).toBeGreaterThanOrEqual(300);
    expect(minutes).toBeLessThanOrEqual(360);
  });

  it("estimates JFK–LHR as a plausible long-haul block time", () => {
    const minutes = estimateTypicalBlockMinutes(JFK_LHR_KM);
    expect(minutes).toBeGreaterThanOrEqual(390);
    expect(minutes).toBeLessThanOrEqual(480);
  });

  it("increases monotonically with distance", () => {
    const short = estimateTypicalBlockMinutes(200);
    const medium = estimateTypicalBlockMinutes(1500);
    const long = estimateTypicalBlockMinutes(8000);
    expect(medium).toBeGreaterThan(short);
    expect(long).toBeGreaterThan(medium);
  });

  it("enforces a minimum block time", () => {
    expect(estimateTypicalBlockMinutes(1)).toBeGreaterThanOrEqual(20);
  });
});

describe("formatFlightTime", () => {
  it("formats sub-hour durations in minutes", () => {
    expect(formatFlightTime(59)).toBe("59 min");
    expect(formatFlightTime(52)).toBe("52 min");
  });

  it("formats hour boundaries", () => {
    expect(formatFlightTime(60)).toBe("1h 00m");
    expect(formatFlightTime(330)).toBe("5h 30m");
    expect(formatFlightTime(725)).toBe("12h 05m");
  });
});
