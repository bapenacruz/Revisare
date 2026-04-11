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
      // Enhanced Railway compatibility with explicit timeouts
      port: 587,
      secure: false, // Use STARTTLS
      requireTLS: true,
      connectionTimeout: 10000, // 10 seconds connection timeout
      greetingTimeout: 5000,    // 5 seconds greeting timeout
      socketTimeout: 15000,     // 15 seconds socket timeout
      debug: process.env.NODE_ENV !== 'production', // Only debug in development
      logger: process.env.NODE_ENV !== 'production', // Only log in development
      // Retry configuration
      pool: false, // Don't use connection pooling for reliability
      maxMessages: 1, // One message per connection
      rateDelta: 1000, // 1 second between messages
      rateLimit: 5, // Max 5 messages per rateDelta period
    });

    // Send email with retry logic for Railway environment
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[contact] Email attempt ${attempt}/${maxRetries}`);
        
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

        console.log(`[contact] ✓ Email sent successfully on attempt ${attempt}`);
        break; // Success - exit retry loop
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[contact] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
        
        if (attempt === maxRetries) {
          throw lastError; // Final attempt failed
        }
        
        // Wait before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[contact] Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[contact] send error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
