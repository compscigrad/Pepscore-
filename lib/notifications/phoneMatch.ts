// Pure phone-number matching helpers -- no Prisma import, so these are
// plain unit-testable functions. Needed because Customer.phone is stored
// exactly as an admin/customer typed it (no normalization on write, see
// lib/intake/validation.ts), while Twilio's inbound webhook always sends
// `From` in E.164 (+15551234567). An exact-string match against Customer.phone
// would silently miss most real rows, so opt-out handling instead compares
// digit sequences.
export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '')
}

// Compares the last 10 digits (US/CA subscriber number, ignoring a leading
// country code either side may or may not include) rather than the full
// digit string, so "+15551234567", "15551234567", and "(555) 123-4567" all
// match each other.
export function phoneNumbersMatch(a: string, b: string): boolean {
  const da = digitsOnly(a)
  const db = digitsOnly(b)
  if (!da || !db) return false
  const tailA = da.slice(-10)
  const tailB = db.slice(-10)
  return tailA.length === 10 && tailA === tailB
}
