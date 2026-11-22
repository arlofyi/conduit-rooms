/**
 * Entity ids: a type prefix, then a ULID-style body (48 bits of time, 80 of
 * randomness, Crockford base32). Ids sort by creation time as plain strings,
 * so "newest first" never needs a second column.
 */

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

export const ID_PREFIXES = {
  directChat: "dm",
  agent: "agent",
  product: "prod",
  artifact: "art",
  room: "room",
  message: "msg",
  wake: "wake",
  event: "evt",
  flag: "flag",
  decision: "dec",
  verdict: "ver",
  handoff: "hof",
  interest: "int",
  note: "note",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

function encodeTime(ms: number): string {
  let remaining = ms;
  let encoded = "";
  for (let i = 0; i < TIME_LENGTH; i++) {
    encoded = ALPHABET[remaining % 32] + encoded;
    remaining = Math.floor(remaining / 32);
  }
  return encoded;
}

function randomDigits(): number[] {
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LENGTH));
  return Array.from(bytes, (byte) => byte % 32);
}

/** Adds one to a base32 number held as digits, carrying leftward. */
function increment(digits: number[]): number[] {
  const next = [...digits];
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i]! < 31) {
      next[i]! += 1;
      return next;
    }
    next[i] = 0;
  }
  return next;
}

let lastTime = -1;
let lastRandom: number[] = [];

/**
 * Two ids minted in the same millisecond must still sort in the order they
 * were minted: a reply is created in the same tick as the message it answers.
 * So within one millisecond the random part counts up instead of being rerolled.
 */
function nextBody(now: number): string {
  if (now <= lastTime) {
    lastRandom = increment(lastRandom);
  } else {
    lastTime = now;
    lastRandom = randomDigits();
  }
  return encodeTime(lastTime) + lastRandom.map((digit) => ALPHABET[digit]).join("");
}

export function newId(kind: IdKind, now: number = Date.now()): string {
  return `${ID_PREFIXES[kind]}_${nextBody(now)}`;
}

export function isIdOf(kind: IdKind, value: string): boolean {
  return value.startsWith(`${ID_PREFIXES[kind]}_`);
}
