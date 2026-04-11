/**
 * Browser-side Ably client (Pusher-compatible mode).
 * Returns null when NEXT_PUBLIC_ABLY_KEY is unset — the UI falls back to polling.
 */
import type Pusher from "pusher-js";

let _client: Pusher | null = null;

export function getPusherClient(): Pusher | null {
  if (typeof window === "undefined") return null;
  if (!process.env.NEXT_PUBLIC_ABLY_KEY) return null;
  if (_client) return _client;
  // Dynamic require keeps pusher-js out of the SSR bundle entirely
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PusherLib = require("pusher-js") as typeof import("pusher-js");
  const PusherClass = (PusherLib as unknown as { default: typeof Pusher }).default ?? PusherLib;
  _client = new PusherClass(process.env.NEXT_PUBLIC_ABLY_KEY, {
    wsHost: "realtime-pusher.ably.io",
    httpHost: "realtime-pusher.ably.io",
    disableStats: true,
    enabledTransports: ["ws"],
    cluster: "us2", // required by pusher-js even when using a custom host
  });
  return _client;
}
