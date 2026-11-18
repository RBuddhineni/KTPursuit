// v1 alumni gate: a shared chapter passcode (CHAPTER_PASSCODE env var).
// Entering it sets an httpOnly cookie holding an HMAC of the passcode, so the cookie
// can't be forged and changing the passcode logs everyone out.
import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "ktp_alumni";

function passcode(): string | null {
  if (process.env.CHAPTER_PASSCODE) return process.env.CHAPTER_PASSCODE;
  // Local dev convenience. In production, no passcode = gate stays locked.
  return process.env.NODE_ENV === "production" ? null : "ktp-dev";
}

function token(code: string) {
  return createHmac("sha256", code).update("ktpursuit-alumni-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Returns the cookie value to set if the passcode is right, else null. */
export function checkPasscode(attempt: string): string | null {
  const code = passcode();
  if (!code || !safeEqual(attempt, code)) return null;
  return token(code);
}

export function isUnlocked(cookieValue: string | undefined): boolean {
  const code = passcode();
  return !!code && !!cookieValue && safeEqual(cookieValue, token(code));
}
