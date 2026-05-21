import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_MASTER_PROMPT } from "@/lib/judging/openrouter-provider";

const TYPE = "master_judging_prompt";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const record = await db.judgePrompt.findFirst({ where: { type: TYPE } });
    return NextResponse.json({
      prompt: record?.prompt ?? DEFAULT_MASTER_PROMPT,
      updatedAt: record?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("Error fetching judge prompt:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const { prompt } = await req.json();
    if (typeof prompt !== "string" || !prompt.trim()) {
      return new NextResponse("Invalid request", { status: 400 });
    }
    await db.judgePrompt.upsert({
      where: { type: TYPE },
      update: { prompt: prompt.trim(), isActive: true, updatedAt: new Date() },
      create: { type: TYPE, prompt: prompt.trim(), isActive: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving judge prompt:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    await db.judgePrompt.deleteMany({ where: { type: TYPE } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resetting judge prompt:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
