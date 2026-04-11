import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { motion?: string; categoryId?: string; isHidden?: boolean };

  const data: { motion?: string; categoryId?: string; isHidden?: boolean } = {};
  if (typeof body.motion === "string" && body.motion.trim()) {
    data.motion = body.motion.trim();
  }
  if (typeof body.categoryId === "string" && body.categoryId.trim()) {
    data.categoryId = body.categoryId.trim();
  }
  if (typeof body.isHidden === "boolean") {
    data.isHidden = body.isHidden;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await db.debate.update({ where: { id }, data });
  return NextResponse.json({ ok: true, debate: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Soft delete by setting isDeleted to true
  const updated = await db.debate.update({ 
    where: { id }, 
    data: { isDeleted: true } 
  });
  
  return NextResponse.json({ ok: true, debate: updated });
}
