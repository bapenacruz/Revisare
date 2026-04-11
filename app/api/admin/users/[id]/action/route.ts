import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

const ACTION_MESSAGES: Record<string, (days?: number) => string> = {
  warn: () => "You have received an official warning from the moderation team for violating platform integrity rules.",
  suspend: (d) => `Your account has been suspended for ${d ?? 7} days due to a confirmed integrity violation.`,
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
    action: "warn" | "suspend" | "ban" | "unban";
    reason?: string;
    suspendDays?: number;
  };

  if (!["warn", "suspend", "ban", "unban"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id: targetId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const days = body.suspendDays ?? 7;

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
      body: msgFn(days),
    });
  }

  return NextResponse.json({ success: true });
}
