import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_ASSESSMENT_SYSTEM_PROMPT } from "@/lib/judging/assessment-prompt";

const TYPE = "assessment_prompt";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const record = await db.judgePrompt.findFirst({ where: { type: TYPE } });
  return NextResponse.json({
    prompt: record?.prompt ?? DEFAULT_ASSESSMENT_SYSTEM_PROMPT,
    updatedAt: record?.updatedAt ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { prompt } = await req.json() as { prompt?: unknown };
  if (typeof prompt !== "string" || !prompt.trim()) {
    return new NextResponse("Invalid request", { status: 400 });
  }
  await db.judgePrompt.upsert({
    where: { type: TYPE },
    update: { prompt: prompt.trim(), isActive: true, updatedAt: new Date() },
    create: { type: TYPE, prompt: prompt.trim(), isActive: true },
  });
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  await db.judgePrompt.deleteMany({ where: { type: TYPE } });
  return NextResponse.json({ success: true, prompt: DEFAULT_ASSESSMENT_SYSTEM_PROMPT });
}
