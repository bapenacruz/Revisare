import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { COUNTRIES } from "@/lib/data/countries";
import {
  countryCodeToRegion,
  getCompassQuadrant,
  matchesTargeting,
  matchesUsernameTargeting,
  matchesCountryTargeting,
  matchesStateTargeting,
} from "@/lib/ad-targeting";

type TargetedJsonFields = {
  targetRegions: unknown;
  targetCompassQuadrants: unknown;
  targetCountries: unknown;
  targetStates: unknown;
  targetUsernames: unknown;
};

function parseTargeting(row: TargetedJsonFields): { regions: string[]; quadrants: string[]; countries: string[]; states: string[]; usernames: string[] } {
  return {
    regions:   Array.isArray(row.targetRegions)          ? (row.targetRegions as string[])          : [],
    quadrants: Array.isArray(row.targetCompassQuadrants) ? (row.targetCompassQuadrants as string[]) : [],
    countries: Array.isArray(row.targetCountries)        ? (row.targetCountries as string[])        : [],
    states:    Array.isArray(row.targetStates)           ? (row.targetStates as string[])           : [],
    usernames: Array.isArray(row.targetUsernames)        ? (row.targetUsernames as string[])        : [],
  };
}

export async function GET() {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;

  let userRegion: string | null = null;
  let userQuadrant: string | null = null;
  let userCountry: string | null = null;
  let userState: string | null = null;
  let username: string | null = null;

  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { country: true, region: true, aiAssessment: true, username: true },
    });
    username = user?.username ?? null;
    userCountry = user?.country ?? null;
    userState = user?.region ?? null;
    if (user?.country) {
      const countryData = COUNTRIES.find((c) => c.name === user.country);
      if (countryData) userRegion = countryCodeToRegion(countryData.code);
    }
    if (user?.aiAssessment) {
      try {
        const parsed = JSON.parse(user.aiAssessment) as Record<string, unknown>;
        const compass = parsed.compass as { economic?: number; social?: number } | undefined;
        if (typeof compass?.economic === "number" && typeof compass?.social === "number") {
          userQuadrant = getCompassQuadrant(compass.economic, compass.social);
        }
      } catch { /* ignore */ }
    }
  }

  function passes(row: TargetedJsonFields): boolean {
    const { regions, quadrants, countries, states, usernames } = parseTargeting(row);
    return matchesTargeting(regions, userRegion)
      && matchesTargeting(quadrants, userQuadrant)
      && matchesCountryTargeting(countries, userCountry)
      && matchesStateTargeting(states, userState)
      && matchesUsernameTargeting(usernames, username);
  }

  const [allAds, allBanners] = await Promise.all([
    db.ad.findMany({
      where: { isActive: true, isDeleted: false },
      select: {
        id: true, motion: true, proponentName: true, opponentName: true, linkUrl: true,
        targetRegions: true, targetCompassQuadrants: true, targetCountries: true, targetStates: true, targetUsernames: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.adBanner.findMany({
      where: { isActive: true, isDeleted: false },
      select: {
        id: true, imageDataUrl: true, linkUrl: true, altText: true,
        targetRegions: true, targetCompassQuadrants: true, targetCountries: true, targetStates: true, targetUsernames: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const ads = allAds
    .filter(passes)
    .map(({ targetRegions: _r, targetCompassQuadrants: _q, targetCountries: _c, targetStates: _s, targetUsernames: _u, ...rest }) => rest);

  const banners = allBanners
    .filter(passes)
    .map(({ targetRegions: _r, targetCompassQuadrants: _q, targetCountries: _c, targetStates: _s, targetUsernames: _u, ...rest }) => rest);

  return NextResponse.json({ ads, banners });
}
