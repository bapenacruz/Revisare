export type NotificationType =
  | "challenge_received"
  | "challenge_accepted"
  | "debate_starting"
  | "result_ready"
  | "integrity_action"
  | "rematch_request"
  | "new_follower"
  | "featured_debate"
  | "opponent_forfeit"
  | "new_comment";

/** The only types shown in the notifications UI and counted in the bell badge. */
export const VISIBLE_NOTIFICATION_TYPES: NotificationType[] = [
  "new_follower",
  "result_ready",
  "challenge_received",
  "featured_debate",
  "opponent_forfeit",
  "integrity_action",
  "new_comment",
];
