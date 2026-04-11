import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer") as typeof import("nodemailer");

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  
  // Only allow admins to test SMTP
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  console.log("[smtp-test] Environment check:", {
    NODE_ENV: process.env.NODE_ENV,
    smtpUserSet: !!smtpUser,
    smtpPassSet: !!smtpPass,
    smtpUserLength: smtpUser?.length,
    smtpPassLength: smtpPass?.length,
    smtpUser: smtpUser?.substring(0, 5) + "...", // Partial for security
  });

  if (!smtpUser || !smtpPass) {
    return NextResponse.json({ 
      success: false,
      error: "SMTP credentials not configured",
      debug: { smtpUserSet: !!smtpUser, smtpPassSet: !!smtpPass }
    }, { status: 500 });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: smtpUser, pass: smtpPass },
      port: 587,
      secure: false,
      requireTLS: true,
      debug: true,
    });

    // Test the connection
    await transporter.verify();
    
    console.log("[smtp-test] Connection verified successfully");

    // Send a test email
    const info = await transporter.sendMail({
      from: `"SMTP Test" <${smtpUser}>`,
      to: smtpUser, // Send to self
      subject: "SMTP Test from Railway",
      text: `SMTP is working correctly on Railway!\n\nTimestamp: ${new Date().toISOString()}`,
    });

    console.log("[smtp-test] Test email sent:", info.messageId);

    return NextResponse.json({
      success: true,
      message: "SMTP test successful",
      messageId: info.messageId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[smtp-test] SMTP test failed:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}