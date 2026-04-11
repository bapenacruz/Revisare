import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

const putSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  emoji: z.string().min(1).max(10).optional(),
  description: z.string().max(200).optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const category = await db.category.update({ where: { id }, data: parsed.data });

  await db.adminAction.create({
    data: {
      adminId: session!.user!.id,
      action: "update_category",
      reason: `Updated category ${category.label} (${id})`,
    },
  });

  return NextResponse.json({ category });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const toDelete = await db.category.findUnique({ where: { id } });
  if (!toDelete) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (toDelete.slug === "other") {
    return NextResponse.json({ error: "Cannot delete the Other category" }, { status: 400 });
  }

  // Ensure "Other" exists — create it if this is the first deletion on a fresh DB
  const otherCat = await db.category.upsert({
    where: { slug: "other" },
    update: {},
    create: {
      slug: "other",
      label: "Other",
      emoji: "💬",
      description: "Debates that don't fit neatly into another category",
      order: 99,
      isActive: true,
    },
  });

  // Move all debates and challenges to Other before deleting
  await db.debate.updateMany({ where: { categoryId: id }, data: { categoryId: otherCat.id } });
  await db.challenge.updateMany({ where: { categoryId: id }, data: { categoryId: otherCat.id } });

  // Delete category (UserFavoriteCategory rows cascade automatically)
  await db.category.delete({ where: { id } });

  await db.adminAction.create({
    data: {
      adminId: session!.user!.id,
      action: "delete_category",
      reason: `Deleted category "${toDelete.label}" (${id}), moved content to Other`,
    },
  });

  return NextResponse.json({ success: true });
}
