import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const profileUpdateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  bio: z.string().max(300).optional(),
  country: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  dob: z.string().optional(),
  gender: z.string().max(20).optional(),
  twitterHandle: z.string().max(50).optional(),
  threadsHandle: z.string().max(50).optional(),
  truthSocialHandle: z.string().max(50).optional(),
  blueskyHandle: z.string().max(80).optional(),
  mastodonHandle: z.string().max(100).optional(),
  websiteUrl: z.string().url().max(200).optional().or(z.literal("")),
  favCategoryIds: z.array(z.string()).max(5).optional(),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { username, favCategoryIds, dob, ...rest } = parsed.data;
    const fields = {
      ...rest,
      ...(dob ? { dob: new Date(dob) } : {}),
    };
    const userId = session.user.id;

    // Username change: enforce once-per-year rule
    if (username && username !== session.user.username) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { lastUsernameChange: true },
      });

      if (user?.lastUsernameChange) {
        const oneYear = 365 * 24 * 60 * 60 * 1000;
        const timeSince = Date.now() - user.lastUsernameChange.getTime();
        if (timeSince < oneYear) {
          const nextAvailable = new Date(user.lastUsernameChange.getTime() + oneYear);
          return NextResponse.json(
            {
              error: `Username can only be changed once per year. Next change available: ${nextAvailable.toLocaleDateString()}`,
            },
            { status: 403 }
          );
        }
      }

      // Check uniqueness
      const taken = await db.user.findFirst({
        where: { username, NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }
    }

    // Update profile in a transaction
    const updated = await db.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          ...fields,
          ...(username && username !== session.user.username
            ? { username, lastUsernameChange: new Date() }
            : {}),
        },
        select: {
          id: true,
          username: true,
          bio: true,
          country: true,
          twitterHandle: true,
          threadsHandle: true,
          truthSocialHandle: true,
          blueskyHandle: true,
          mastodonHandle: true,
          websiteUrl: true,
          lastUsernameChange: true,
          favCategories: { select: { categoryId: true } },
        },
      });

      if (favCategoryIds !== undefined) {
        await tx.userFavoriteCategory.deleteMany({ where: { userId } });
        if (favCategoryIds.length > 0) {
          await tx.userFavoriteCategory.createMany({
            data: favCategoryIds.map((categoryId) => ({ userId, categoryId })),
          });
        }
      }

      return updatedUser;
    });

    return NextResponse.json({ success: true, user: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      bio: true,
      avatarUrl: true,
      country: true,
      twitterHandle: true,
      threadsHandle: true,
      truthSocialHandle: true,
      blueskyHandle: true,
      mastodonHandle: true,
      websiteUrl: true,
      lastUsernameChange: true,
      createdAt: true,
      aiAssessment: true,
      favCategories: {
        select: {
          category: {
            select: { id: true, slug: true, label: true, emoji: true },
          },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ user });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await db.user.delete({ where: { id: session.user.id } });
  return NextResponse.json({ success: true });
}
