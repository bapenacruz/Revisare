/**
 * Topic/motion quality validator.
 * Returns null if valid, or an error string if rejected.
 */

const MIN_LENGTH = 10;
const MAX_LENGTH = 280;

const TROLL_PATTERNS = [
  /\b(asdf|qwerty|lorem ipsum|test123)\b/i,
  /(.)\1{5,}/, // 6+ repeated chars e.g. "aaaaaa"
  /^[^a-z]+$/i, // no letters at all
];

const WEAK_PATTERNS = [
  /^(yes|no|maybe|idk|lol|haha|ok|okay|sure|nope)\b/i,
];

export function validateMotion(motion: string): string | null {
  const t = motion.trim();
  if (t.length < MIN_LENGTH) return `Motion must be at least ${MIN_LENGTH} characters.`;
  if (t.length > MAX_LENGTH) return `Motion must be ${MAX_LENGTH} characters or fewer.`;
  for (const p of TROLL_PATTERNS) {
    if (p.test(t)) return "This doesn't look like a real debate motion. Please write a genuine, arguable topic.";
  }
  for (const p of WEAK_PATTERNS) {
    if (p.test(t)) return "Motion is too vague. Please write a clear, debatable position.";
  }
  return null;
}

export function motionTip(motion: string): string | null {
  const t = motion.trim();
  if (t.length < MIN_LENGTH) return null;
  const strong = [
    /^this house (believes?|would|supports?|opposes?)/i,
    /\bshould\b/i,
    /\bought to\b/i,
    /\bdoes more harm than good\b/i,
    /\bhas failed\b/i,
  ];
  const hasStrong = strong.some((p) => p.test(t));
  if (!hasStrong) {
    return "Tip: Strong motions often start with \"This house believes\u2026\" or \"should\u2026\"";
  }
  return null;
}
