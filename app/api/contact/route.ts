import { NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Attachment {
  filename: string;
  content: string; // base64
}

interface ContactPayload {
  category: string;
  email: string;
  subject?: string;
  message: string;
  attachments?: Attachment[];
}

export async function POST(request: Request) {
  try {
    const body: ContactPayload = await request.json();
    const { category, email, subject, message, attachments = [] } = body;

    if (!category?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await db.contactMessage.create({
      data: {
        category: category.trim(),
        email: email.trim(),
        subject: (subject ?? "").trim(),
        message: message.trim(),
        attachments: attachments as object[],
        status: "unread",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[contact] save error:", msg);
    return NextResponse.json({ error: "Failed to submit. Please try again." }, { status: 500 });
  }
}
