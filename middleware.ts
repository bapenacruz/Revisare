import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/auth", "/api", "/_next", "/onboarding", "/favicon.ico"];

// Matches /debates/<id> and /debates/<id>/results (not /debates/new, /debates/page, etc.)
const DEBATE_DETAIL = /^\/debates\/([^/]+?)(?:\/results)?$/;
// IDs that are real route segments, not dynamic debate IDs
const STATIC_SEGMENTS = new Set(["new", "page", "gate"]);

const GUEST_VIEW_COOKIE = "grv";
const DAILY_GUEST_LIMIT = 2;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

interface GuestViews {
  d: string;       // date string "YYYY-MM-DD"
  ids: string[];   // challenge IDs seen today
}

function parseGuestViews(raw: string | undefined): GuestViews {
  try {
    if (raw) {
      const v = JSON.parse(decodeURIComponent(raw)) as GuestViews;
      if (v.d === todayUTC() && Array.isArray(v.ids)) return v;
    }
  } catch { /* ignore */ }
  return { d: todayUTC(), ids: [] };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths through without checks
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  // Signed in but hasn't completed onboarding → redirect to /onboarding
  if (token && token.onboardingComplete === false) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // ── Guest debate view limit ────────────────────────────────────────────────
  if (!token) {
    const match = DEBATE_DETAIL.exec(pathname);
    if (match) {
      const challengeId = match[1];
      if (!STATIC_SEGMENTS.has(challengeId)) {
        // Skip for Next.js prefetch requests only — these fire in the background
        // and must not consume a slot. Actual link-click navigations (RSC: 1
        // without the prefetch header) and direct browser loads should be counted.
        const isPrefetch =
          req.headers.get("Next-Router-Prefetch") === "1" ||
          req.headers.get("Purpose") === "prefetch";
        if (isPrefetch) return NextResponse.next();
        const raw = req.cookies.get(GUEST_VIEW_COOKIE)?.value;
        const views = parseGuestViews(raw);

        if (!views.ids.includes(challengeId)) {
          if (views.ids.length >= DAILY_GUEST_LIMIT) {
            // Limit reached — send to gate page
            return NextResponse.redirect(new URL("/debates/gate", req.url));
          }
          // First visit to this debate — register it
          views.ids.push(challengeId);
          const res = NextResponse.next();
          res.cookies.set(GUEST_VIEW_COOKIE, encodeURIComponent(JSON.stringify(views)), {
            path: "/",
            maxAge: 60 * 60 * 24, // 24 h
            sameSite: "lax",
            httpOnly: false,
          });
          return res;
        }
        // Already visited this specific debate — allow through freely
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
