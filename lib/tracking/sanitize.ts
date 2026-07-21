// Carrier-provided text (status descriptions, locations) is untrusted input
// from a third party — strip anything that could be interpreted as markup
// before it's stored/rendered (in the invoice UI, PDF, or an email).
export function sanitizeCarrierText(text: string | null | undefined, maxLength = 500): string {
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .slice(0, maxLength)
}
