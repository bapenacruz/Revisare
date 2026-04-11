import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

export async function GET() {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const categories = await db.category.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ categories });
}

const patchSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(50).optional(),
  emoji: z.string().min(1).max(4).optional(),
  description: z.string().max(200).optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  const category = await db.category.update({ where: { id }, data });

  await db.adminAction.create({
    data: {
      adminId: session!.user!.id,
      action: "update_category",
      reason: `Updated category ${id}`,
    },
  });

  return NextResponse.json({ category });
}
