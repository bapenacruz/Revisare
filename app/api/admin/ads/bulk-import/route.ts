import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const TurnSchema = z.object({
  speaker: z.enum(["proponent", "opponent"]),
  roundName: z.enum(["opening", "crossfire", "rebuttal", "summary", "closing"]),
  content: z.string().min(1),
});

const AdImportSchema = z.object({
  motion: z.string().min(5).max(500),
  proponent_name: z.string().min(1).max(100),
  opponent_name: z.string().min(1).max(100),
  ad_category_slug: z.string().optional().nullable(),
  link_url: z.string().url().optional().nullable(),
  turns: z.array(TurnSchema).min(1),
  created_at: z.string().optional().nullable(),
});

type AdInput = z.infer<typeof AdImportSchema>;

export interface AdImportResult {
  index: number;
  motion: string;
  status: "created" | "error";
  error?: string;
  adId?: string;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected a JSON array of ad objects" }, { status: 400 });
  }
  if (body.length === 0) {
    return NextResponse.json({ error: "Array is empty" }, { status: 400 });
  }

  const results: AdImportResult[] = [];

  for (let i = 0; i < body.length; i++) {
    const raw = body[i];
    const parsed = AdImportSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({
        index: i,
        motion: (raw as Record<string, unknown>)?.motion as string ?? `Ad #${i + 1}`,
        status: "error",
        error: parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      });
      continue;
    }

    const data: AdInput = parsed.data;

    try {
      // Resolve optional ad category
      let categoryId: string | null = null;
      if (data.ad_category_slug) {
        const cat = await db.adCategory.findUnique({
          where: { slug: data.ad_category_slug },
          select: { id: true },
        });
        if (!cat) {
          results.push({
            index: i,
            motion: data.motion,
            status: "error",
            error: `Ad category slug "${data.ad_category_slug}" not found`,
          });
          continue;
        }
        categoryId = cat.id;
      }

      const ad = await db.ad.create({
        data: {
          motion: data.motion,
          proponentName: data.proponent_name,
          opponentName: data.opponent_name,
          categoryId,
          linkUrl: data.link_url ?? null,
          isActive: true,
          createdAt: data.created_at ? new Date(data.created_at) : undefined,
          turns: {
            create: data.turns.map((t, idx) => ({
              speaker: t.speaker,
              roundName: t.roundName,
              content: t.content,
              order: idx,
            })),
          },
        },
        select: { id: true },
      });

      results.push({ index: i, motion: data.motion, status: "created", adId: ad.id });
    } catch (err) {
      results.push({
        index: i,
        motion: data.motion,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const errors = results.filter((r) => r.status === "error").length;
  return NextResponse.json({ results, created, errors });
}
