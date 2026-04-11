import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const prompts = await db.judgePrompt.findMany({
      orderBy: { type: 'asc' }
    });

    // Define default prompts if none exist
    const defaultPrompts = [
      {
        type: "judge1_grok",
        prompt: `You are Judge 1 (Grok). You are known for wit, directness, and spotting weak evidence quickly. Weight factual accuracy above all other criteria.`
      },
      {
        type: "judge2_claude",
        prompt: `You are Judge 2 (Claude). You are known for meticulous, dispassionate analysis. You are especially skilled at identifying misleading framing — claims that are technically true but create a false impression. Give no credit for rhetorical polish if the underlying facts are shaky.`
      },
      {
        type: "judge3_chatgpt",
        prompt: `You are Judge 3 (ChatGPT Arbiter). You have access to the full debate transcript AND both peer verdicts. Your explanation should briefly note where the peer judges agreed or diverged, and add any factual findings they missed.`
      },
      {
        type: "private_feedback",
        prompt: `Be direct and specific. Focus on the debater's biggest factual error and the one concrete action they can take to improve. Keep feedback concise and actionable.`
      },
      {
        type: "official_result",
        prompt: `Keep the official result summary concise (3-5 sentences). Lead with who won and by what vote. Focus on the key factual difference that decided the debate.`
      }
    ];

    // If no prompts exist, return defaults
    if (prompts.length === 0) {
      return NextResponse.json(defaultPrompts.map(p => ({ ...p, isActive: true })));
    }

    // Merge existing with defaults for any missing types
    const existingTypes = new Set(prompts.map(p => p.type));
    const missingDefaults = defaultPrompts.filter(p => !existingTypes.has(p.type));
    
    const allPrompts = [...prompts, ...missingDefaults.map(p => ({ ...p, isActive: true }))];
    
    return NextResponse.json(allPrompts);
  } catch (error) {
    console.error("Error fetching judge prompts:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { prompts } = await req.json();

    if (!Array.isArray(prompts)) {
      return new NextResponse("Invalid request format", { status: 400 });
    }

    // Batch update all prompts
    for (const promptData of prompts) {
      await db.judgePrompt.upsert({
        where: { type: promptData.type },
        update: {
          prompt: promptData.prompt,
          isActive: promptData.isActive,
          updatedAt: new Date()
        },
        create: {
          type: promptData.type,
          prompt: promptData.prompt,
          isActive: promptData.isActive
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating judge prompts:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    await db.judgePrompt.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resetting judge prompts:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}