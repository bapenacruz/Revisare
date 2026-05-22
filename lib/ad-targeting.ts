// Continent/region targeting constants — shared between admin UI and API filtering

export const AD_REGIONS = [
  { value: "north-america", label: "North America" },
  { value: "south-america", label: "South America" },
  { value: "europe",        label: "Europe" },
  { value: "middle-east",   label: "Middle East" },
  { value: "africa",        label: "Africa" },
  { value: "asia",          label: "Asia" },
  { value: "oceania",       label: "Oceania" },
] as const;

export type AdRegion = (typeof AD_REGIONS)[number]["value"];

// Political compass quadrants
export const AD_COMPASS_QUADRANTS = [
  { value: "auth-left",  label: "Auth-Left",  description: "Authoritarian Left",  fill: "rgba(239,68,68,0.4)"   },
  { value: "auth-right", label: "Auth-Right", description: "Authoritarian Right", fill: "rgba(59,130,246,0.4)"  },
  { value: "lib-left",   label: "Lib-Left",   description: "Libertarian Left",    fill: "rgba(34,197,94,0.4)"   },
  { value: "lib-right",  label: "Lib-Right",  description: "Libertarian Right",   fill: "rgba(234,179,8,0.4)"   },
] as const;

export type AdCompassQuadrant = (typeof AD_COMPASS_QUADRANTS)[number]["value"];

// Determine which quadrant a user falls into given their compass coords
// economic: -1 (left) → +1 (right) ; social: -1 (lib) → +1 (auth)
export function getCompassQuadrant(economic: number, social: number): AdCompassQuadrant {
  if (social >= 0) return economic >= 0 ? "auth-right" : "auth-left";
  return economic >= 0 ? "lib-right" : "lib-left";
}

// ISO 3166-1 alpha-2 code → ad region
const CODE_TO_REGION: Record<string, AdRegion> = {
  // North America
  US: "north-america", CA: "north-america", MX: "north-america", GT: "north-america",
  CU: "north-america", DO: "north-america", HT: "north-america", JM: "north-america",
  // South America
  BR: "south-america", AR: "south-america", CO: "south-america", CL: "south-america",
  PE: "south-america", VE: "south-america", EC: "south-america", BO: "south-america",
  PY: "south-america", UY: "south-america",
  // Europe
  GB: "europe", DE: "europe", FR: "europe", IT: "europe", ES: "europe", NL: "europe",
  PL: "europe", SE: "europe", NO: "europe", DK: "europe", FI: "europe", PT: "europe",
  BE: "europe", AT: "europe", CH: "europe", IE: "europe", GR: "europe", CZ: "europe",
  HU: "europe", RO: "europe", UA: "europe", SK: "europe", HR: "europe", BG: "europe",
  RS: "europe", LT: "europe", LV: "europe", EE: "europe", LU: "europe", SI: "europe",
  IS: "europe", MK: "europe", AL: "europe", BA: "europe", ME: "europe", MT: "europe",
  CY: "europe", BY: "europe", MD: "europe", RU: "europe",
  // Middle East
  IL: "middle-east", SA: "middle-east", AE: "middle-east", TR: "middle-east",
  EG: "middle-east", IR: "middle-east", IQ: "middle-east", JO: "middle-east",
  LB: "middle-east", KW: "middle-east", QA: "middle-east", BH: "middle-east",
  OM: "middle-east", YE: "middle-east", SY: "middle-east",
  // Africa
  ZA: "africa", NG: "africa", KE: "africa", GH: "africa", ET: "africa",
  TZ: "africa", MA: "africa", DZ: "africa", TN: "africa", SN: "africa",
  CI: "africa", CM: "africa", UG: "africa", MZ: "africa", ZW: "africa",
  // Asia
  CN: "asia", JP: "asia", IN: "asia", KR: "asia", ID: "asia", TH: "asia",
  VN: "asia", PH: "asia", MY: "asia", SG: "asia", BD: "asia", PK: "asia",
  TW: "asia", HK: "asia", MN: "asia", NP: "asia", LK: "asia", KH: "asia",
  MM: "asia", LA: "asia", KZ: "asia", UZ: "asia",
  // Oceania
  AU: "oceania", NZ: "oceania", PG: "oceania", FJ: "oceania",
};

export function countryCodeToRegion(code: string): AdRegion | null {
  return CODE_TO_REGION[code.toUpperCase()] ?? null;
}

// Check whether a targeting array matches: empty = all, else must include value
export function matchesTargeting(targeting: string[], value: string | null): boolean {
  if (targeting.length === 0) return true;     // no restriction
  if (!value) return false;                    // user has no data, ad is restricted
  return targeting.includes(value);
}

// Check username targeting: empty = all, else the session username must be in the list
export function matchesUsernameTargeting(targetUsernames: string[], username: string | null): boolean {
  if (targetUsernames.length === 0) return true;
  if (!username) return false;
  return targetUsernames.includes(username);
}
