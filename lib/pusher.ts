/**
 * Ably realtime service — server-side publishing via Ably's native REST SDK.
 * Client-side subscribes via pusher-js (Ably Pusher-compatible WebSocket).
 *
 * SETUP: Create a free app at https://ably.com → API Keys → Root key
 *   ABLY_API_KEY=appId.keyId:keySecret   (full key — server only)
 *   NEXT_PUBLIC_ABLY_KEY=appId.keyId     (public part — client safe)
 *
 * Without ABLY_API_KEY the app falls back to polling — fully functional.
 */
import Ably from "ably";

let _ably: Ably.Rest | null = null;

function getAbly(): Ably.Rest | null {
  if (!process.env.ABLY_API_KEY) return null;
  if (_ably) return _ably;
  _ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  return _ably;
}

export async function pusherTrigger(
  channel: string,
  event: string,
  data: unknown,
): Promise<void> {
  const ably = getAbly();
  if (!ably) return; // graceful no-op when keys are absent
  try {
    await ably.channels.get(channel).publish(event, data);
  } catch (err) {
    console.error("[Ably] trigger failed:", err);
  }
}

/** Channel name helpers */
export const CHANNELS = {
  lobby: (challengeId: string) => `lobby-${challengeId}`,
  debate: (challengeId: string) => `debate-${challengeId}`,
  notifications: (userId: string) => `user-${userId}`,
};

export const EVENTS = {
  LOBBY_MESSAGE: "lobby:message",
  LOBBY_TERMS_ACCEPTED: "lobby:terms-accepted",
  LOBBY_LOCKED: "lobby:locked",
  LOBBY_JOIN_REQUEST: "lobby:join-request",
  DEBATE_STATE_CHANGED: "debate:state-changed",
  DEBATE_TURN_SUBMITTED: "debate:turn-submitted",
  DEBATE_SECOND_CHANCE: "debate:second-chance",
  SPECTATOR_MESSAGE: "spectator:message",
  NOTIFICATION: "notification:new",
};
