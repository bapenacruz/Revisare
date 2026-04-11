import { db } from "@/lib/db";
import { pusherTrigger, CHANNELS, EVENTS } from "@/lib/pusher";
import { sendWebPush } from "@/lib/web-push";
import type { NotificationType } from "@/lib/notification-types";

export type { NotificationType };
export { VISIBLE_NOTIFICATION_TYPES } from "@/lib/notification-types";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  challengeId?: string;
}

export async function createNotification(
  userId: string,
  payload: NotificationPayload,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isExhibition: true },
  });
  if (user?.isExhibition) return; // skip exhibition accounts

  // One notification per debate per type — delete any prior one before inserting
  if (payload.challengeId) {
    await db.notification.deleteMany({
      where: {
        userId,
        type: payload.type,
        payload: { contains: payload.challengeId },
      },
    });
  }

  const notif = await db.notification.create({
    data: {
      userId,
      type: payload.type,
      payload: JSON.stringify(payload),
    },
  });

  // Push real-time delivery
  await pusherTrigger(CHANNELS.notifications(userId), EVENTS.NOTIFICATION, {
    id: notif.id,
    ...payload,
    createdAt: notif.createdAt,
  });

  // Background push notification (when app is closed/backgrounded)
  await sendWebPush(userId, {
    title: payload.title,
    body: payload.body,
    href: payload.href,
  });
}
