/**
 * Browser-side Ably client (Pusher-compatible mode).
 * Returns null when NEXT_PUBLIC_ABLY_KEY is unset — the UI falls back to polling.
 */
import Pusher from "pusher-js";

let _client: Pusher | null = null;

export function getPusherClient(): Pusher | null {
  if (typeof window === "undefined") return null;
  if (!process.env.NEXT_PUBLIC_ABLY_KEY) return null;
  if (_client) return _client;
  _client = new Pusher(process.env.NEXT_PUBLIC_ABLY_KEY, {
    wsHost: "realtime-pusher.ably.io",
    httpHost: "realtime-pusher.ably.io",
    disableStats: true,
    enabledTransports: ["ws"],
    cluster: "us2", // required by pusher-js even when using a custom host
  });
  return _client;
}
