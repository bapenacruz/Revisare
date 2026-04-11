import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as {
    status: "reviewed" | "dismissed";
    resolution?: string;
  };

  if (!["reviewed", "dismissed"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await db.integrityFlag.update({
    where: { id },
    data: {
      status: body.status,
      resolution: body.resolution ?? null,
      reviewedBy: session!.user!.id,
      reviewedAt: new Date(),
    },
  });

  await db.adminAction.create({
    data: {
      adminId: session!.user!.id,
      flagId: id,
      action: `flag_${body.status}`,
      reason: body.resolution ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
