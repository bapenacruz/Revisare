import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const DEFAULTS = {
  supportEmail: "support@arguably.app",
  contactMailtoBody:
    "[Your message here]\n\n--- Do not modify below ---\nUsername: [username]\nCountry: [country]\nRegion: [region]\n---",
};

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.siteSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    supportEmail: settings?.supportEmail ?? DEFAULTS.supportEmail,
    contactMailtoBody: settings?.contactMailtoBody ?? DEFAULTS.contactMailtoBody,
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { supportEmail, contactMailtoBody } = body as Record<string, unknown>;

  if (supportEmail !== undefined && (typeof supportEmail !== "string" || !supportEmail.includes("@"))) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (contactMailtoBody !== undefined && typeof contactMailtoBody !== "string") {
    return NextResponse.json({ error: "Invalid mailto body" }, { status: 400 });
  }

  const updated = await db.siteSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      supportEmail: (typeof supportEmail === "string" ? supportEmail : DEFAULTS.supportEmail),
      contactMailtoBody: (typeof contactMailtoBody === "string" ? contactMailtoBody : DEFAULTS.contactMailtoBody),
    },
    update: {
      ...(typeof supportEmail === "string" ? { supportEmail } : {}),
      ...(typeof contactMailtoBody === "string" ? { contactMailtoBody } : {}),
    },
  });

  return NextResponse.json({
    supportEmail: updated.supportEmail,
    contactMailtoBody: updated.contactMailtoBody,
  });
}
