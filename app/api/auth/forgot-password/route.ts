import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer") as typeof import("nodemailer");

export async function POST(request: Request) {
  try {
    const body = await request.json() as { emailOrUsername?: string };
    const raw = (body.emailOrUsername ?? "").trim().toLowerCase();

    if (!raw) {
      return NextResponse.json({ error: "Email or username required" }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: {
        OR: [{ email: raw }, { username: raw }],
        isDeleted: false,
      },
      select: { id: true, email: true, username: true },
    });

    // Always return success to avoid user enumeration
    if (!user || user.email.endsWith("@placeholder.com")) {
      return NextResponse.json({ ok: true });
    }

    // Invalidate old unused tokens for this user
    await db.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL ?? "https://revisare.app"}/auth/reset-password?token=${token}`;

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: `"Revisare" <${smtpUser}>`,
        to: user.email,
        subject: "Reset your Revisare password",
        text: `Hi ${user.username},\n\nWe received a request to reset your password.\n\nClick the link below (expires in 2 hours):\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
        html: `<p>Hi <strong>${user.username}</strong>,</p><p>We received a request to reset your password.</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link expires in 2 hours. If you didn't request this, you can ignore this email.</p>`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[forgot-password]", msg);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
