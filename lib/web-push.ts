import webpush from "web-push";
import { db } from "@/lib/db";

let _configured = false;

function configure() {
  if (_configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!pub || !priv) return;
  webpush.setVapidDetails(subject, pub, priv);
  _configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  href?: string;
}

/**
 * Send a web push notification to all subscriptions for a user.
 * Silently removes stale/expired subscriptions (410 Gone).
 */
export async function sendWebPush(userId: string, payload: PushPayload): Promise<void> {
  configure();
  if (!_configured) return;

  const subs = await db.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const staleIds: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 410 || status === 404) {
          staleIds.push(sub.id);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
  }
}
