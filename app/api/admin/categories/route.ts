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

const postSchema = z.object({
  label: z.string().min(1).max(50),
  emoji: z.string().min(1).max(10),
  description: z.string().max(200).default(""),
  isActive: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { label, emoji, description, isActive } = parsed.data;
  const baseSlug = label.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

  // Ensure unique slug
  let slug = baseSlug;
  let suffix = 0;
  while (await db.category.findUnique({ where: { slug } })) {
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }

  const maxOrder = await db.category.aggregate({ _max: { order: true } });
  const category = await db.category.create({
    data: {
      slug,
      label,
      emoji,
      description,
      order: (maxOrder._max.order ?? 0) + 1,
      isActive: isActive ?? true,
    },
  });

  await db.adminAction.create({
    data: {
      adminId: session!.user!.id,
      action: "create_category",
      reason: `Created category ${label} (${category.id})`,
    },
  });

  return NextResponse.json({ category }, { status: 201 });
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
