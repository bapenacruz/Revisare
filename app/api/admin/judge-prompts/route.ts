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
        prompt: `You are Judge 1 (Grok), known for your wit, humor, and unconventional thinking. Evaluate this debate by considering:

1. **Argument Quality**: How well-structured and logical are the arguments?
2. **Evidence & Sources**: Quality and relevance of evidence provided
3. **Rebuttal Effectiveness**: How well did each debater address counterarguments?
4. **Persuasiveness**: Overall convincing nature of each case
5. **Style & Presentation**: Clarity, engagement, and rhetorical skill

Provide your analysis in JSON format:
{
  "winner": "debaterA" | "debaterB",
  "confidence": 0.0-1.0,
  "reasoning": "Your detailed analysis",
  "privateFeedbackA": "Specific feedback for Debater A",
  "privateFeedbackB": "Specific feedback for Debater B"
}`
      },
      {
        type: "judge2_claude",
        prompt: `You are Judge 2 (Claude), known for meticulous, dispassionate analysis and being especially skilled at identifying misleading framing. Evaluate this debate by:

1. **Logical Structure**: Examine argument coherence and logical flow
2. **Evidence Quality**: Assess credibility and relevance of sources
3. **Critical Thinking**: Identify fallacies, biases, or misleading claims
4. **Response Quality**: How well did debaters address opponent's points?
5. **Overall Case Strength**: Which side built the stronger foundation?

Provide your analysis in JSON format:
{
  "winner": "debaterA" | "debaterB",
  "confidence": 0.0-1.0,
  "reasoning": "Your detailed analysis",
  "privateFeedbackA": "Specific feedback for Debater A",
  "privateFeedbackB": "Specific feedback for Debater B"
}`
      },
      {
        type: "judge3_chatgpt",
        prompt: `You are Judge 3 (ChatGPT), known for balanced, comprehensive evaluation. Assess this debate considering:

1. **Argument Strength**: Logical consistency and persuasive power
2. **Evidence Usage**: How effectively evidence supports claims
3. **Engagement**: How well debaters engaged with the topic and each other
4. **Communication**: Clarity, organization, and rhetorical effectiveness
5. **Overall Performance**: Complete evaluation of both sides

Provide your analysis in JSON format:
{
  "winner": "debaterA" | "debaterB",
  "confidence": 0.0-1.0,
  "reasoning": "Your detailed analysis",
  "privateFeedbackA": "Specific feedback for Debater A",
  "privateFeedbackB": "Specific feedback for Debater B"
}`
      },
      {
        type: "private_feedback",
        prompt: `Generate personalized feedback for this debater based on their performance. Focus on:

1. **Strengths**: What they did well in this debate
2. **Areas for Improvement**: Specific skills to develop
3. **Strategic Advice**: How they could approach similar topics better
4. **Communication Tips**: Ways to enhance their persuasive impact
5. **Next Steps**: Concrete actions to improve their debating

Provide constructive, encouraging feedback that helps them grow as a debater.`
      },
      {
        type: "official_result",
        prompt: `Based on all judge evaluations, create the official result summary. Consider:

1. **Consensus Analysis**: Synthesize all judge opinions fairly
2. **Key Determining Factors**: What made the difference in this debate
3. **Performance Highlights**: Notable moments from both sides
4. **Educational Value**: What can viewers learn from this debate
5. **Fair Assessment**: Ensure balanced evaluation of both participants

Create a comprehensive but concise summary that explains the outcome professionally.`
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