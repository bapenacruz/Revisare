import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { token, password } = parsed.data;

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, isDeleted: true } } },
    });

    if (!resetToken) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }
    if (resetToken.usedAt) {
      return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 });
    }
    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "This reset link has expired" }, { status: 400 });
    }
    if (resetToken.user.isDeleted) {
      return NextResponse.json({ error: "Account not found" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: { hashedPassword },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all sessions so stale sessions can't be reused
      db.session.deleteMany({ where: { userId: resetToken.userId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reset-password]", msg);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
