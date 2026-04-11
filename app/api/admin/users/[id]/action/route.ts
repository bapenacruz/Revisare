import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import crypto from "crypto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer") as typeof import("nodemailer");

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

const ACTION_MESSAGES: Record<string, (displayDuration?: string) => string> = {
  warn: () => "You have received an official warning from the moderation team for violating platform integrity rules.",
  suspend: (d) => `Your account has been suspended for ${d ?? "7 days"} due to a confirmed integrity violation.`,
  ban: () => "Your account has been permanently banned due to repeated or severe integrity violations.",
  unban: () => "Your account restriction has been lifted. Please ensure you follow platform rules going forward.",
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!isAdmin((session?.user as { role?: string })?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: targetId } = await params;
  const body = await req.json() as {
    action: "warn" | "suspend" | "ban" | "unban" | "reset-password";
    reason?: string;
    suspendDays?: number;
  };

  if (!["warn", "suspend", "ban", "unban", "reset-password"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id: targetId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const days = body.suspendDays ?? 7;
  const displayDuration = days < 1
    ? `${Math.round(days * 24 * 60)} minutes`
    : `${days} days`;

  // Handle reset-password separately — no notification/audit pattern matching ACTION_MESSAGES
  if (body.action === "reset-password") {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    await db.passwordResetToken.create({
      data: { userId: target.id, token, expiresAt },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL ?? "https://revisare.app"}/auth/reset-password?token=${token}`;
    const isPlaceholder = target.email.endsWith("@placeholder.com");

    let emailSent = false;
    if (!isPlaceholder) {
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      if (smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.sendMail({
          from: `"Revisare" <${smtpUser}>`,
          to: target.email,
          subject: "Reset your Revisare password",
          text: `Hi ${target.username},\n\nAn admin has initiated a password reset for your account.\n\nClick the link below to set a new password (expires in 2 hours):\n\n${resetUrl}\n\nIf you did not request this, you can ignore it.`,
          html: `<p>Hi <strong>${target.username}</strong>,</p><p>An admin has initiated a password reset for your account.</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link expires in 2 hours.</p>`,
        });
        emailSent = true;
      }
    }

    await db.adminAction.create({
      data: { adminId: session!.user!.id, targetId, action: "reset-password", reason: body.reason ?? null },
    });

    return NextResponse.json({ 
      success: true, 
      resetUrl: isPlaceholder ? resetUrl : null, 
      emailSent,
      message: emailSent ? "Reset email sent ✓" : isPlaceholder ? "Reset link generated ✓ (placeholder account)" : "Reset link generated ✓ (check SMTP configuration for email)"
    });
  }

  const userUpdate: Record<string, unknown> = {};
  if (body.action === "suspend") {
    userUpdate.suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    userUpdate.role = "suspended";
  } else if (body.action === "ban") {
    userUpdate.role = "banned";
    userUpdate.suspendedUntil = null;
  } else if (body.action === "unban") {
    userUpdate.role = "user";
    userUpdate.suspendedUntil = null;
  }
  // warn: no user update, just notification + audit log

  if (Object.keys(userUpdate).length > 0) {
    await db.user.update({ where: { id: targetId }, data: userUpdate });
  }

  await db.adminAction.create({
    data: {
      adminId: session!.user!.id,
      targetId,
      action: body.action,
      reason: body.reason ?? null,
    },
  });

  // Notify the target user
  const msgFn = ACTION_MESSAGES[body.action];
  if (msgFn) {
    await createNotification(targetId, {
      type: "integrity_action",
      title:
        body.action === "warn"
          ? "You have received a warning"
          : body.action === "suspend"
            ? "Your account has been suspended"
            : body.action === "ban"
              ? "Your account has been banned"
              : "Account restriction lifted",
      body: msgFn(displayDuration),
    });
  }

  return NextResponse.json({ success: true });
}
