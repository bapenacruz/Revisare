import { NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer") as typeof import("nodemailer");

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
    const { category, email: replyTo, subject, message, attachments = [] } = body;
    const to = process.env.CONTACT_TO ?? "bapenacruz@gmail.com";

    if (!category?.trim() || !replyTo?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.error("[contact] SMTP_USER or SMTP_PASS not configured");
      return NextResponse.json({ error: "SMTP not configured — add SMTP_PASS to .env and restart." }, { status: 503 });
    }

    console.log("[contact] SMTP config check:", { 
      userOk: !!smtpUser, 
      passOk: !!smtpPass,
      userLength: smtpUser?.length,
      passLength: smtpPass?.length 
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: smtpUser, pass: smtpPass },
      // Add explicit configuration for better Railway compatibility
      port: 587,
      secure: false, // Use STARTTLS
      requireTLS: true,
      debug: true, // Enable debug logs
    });

    await transporter.sendMail({
      from: `"Revisare Contact" <${smtpUser}>`,
      to,
      replyTo,
      subject: `[Revisare] ${category}${subject ? ` — ${subject}` : ``} (from ${replyTo})`,
      text: `Category: ${category}\nFrom: ${replyTo}\nSubject: ${subject ?? ""}\n\n${message}`,
      html: `
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>From:</strong> ${replyTo}</p>
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ""}
        <hr />
        <p style="white-space:pre-wrap">${message.replace(/</g, "&lt;")}</p>
      `,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
      })),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[contact] send error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
