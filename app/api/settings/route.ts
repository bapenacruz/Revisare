import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULTS = {
  supportEmail: "support@arguably.app",
  contactMailtoBody:
    "[Your message here]\n\n--- Do not modify below ---\nUsername: [username]\nCountry: [country]\nRegion: [region]\n---",
};

export async function GET() {
  const settings = await db.siteSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    supportEmail: settings?.supportEmail ?? DEFAULTS.supportEmail,
    contactMailtoBody: settings?.contactMailtoBody ?? DEFAULTS.contactMailtoBody,
  });
}
