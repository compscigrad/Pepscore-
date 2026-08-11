import { timingSafeEqual } from 'crypto'

// Constant-time string comparison for shared secrets (cron auth, webhook
// tokens) -- a plain `===` leaks how many leading characters matched via
// response timing, letting an attacker recover a long-lived secret one
// byte at a time. timingSafeEqual() itself throws on mismatched buffer
// lengths rather than returning false, so the length check has to happen
// first; this is the standard, widely-used shape for that comparison.
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
