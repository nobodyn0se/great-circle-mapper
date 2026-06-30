export type NavFix = {
  id: string;
  lat: number;
  lon: number;
};

export type NavEdge = {
  from: string;
  to: string;
  distanceNm: number;
};

export type NavGraph = {
  version: string;
  source: string;
  fixes: NavFix[];
  edges: NavEdge[];
};

export const FAA_NASR_SUBSCRIPTION_URL =
  "https://nfdc.faa.gov/webContent/28DaySub/28DaySubscription_Effective_2026-05-14.zip";
