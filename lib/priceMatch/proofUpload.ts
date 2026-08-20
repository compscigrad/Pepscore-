// Transient supporting-proof file handling (Price Match sprint, 2026-08-20
// closure pass). Owner decision: no paid Blob/S3 storage for this launch --
// a submitted file is validated in-memory, attached directly to the admin
// alert email, and discarded immediately after. This module only ever
// handles a Buffer that lives for the duration of one request; nothing here
// writes file bytes anywhere durable.
export const ALLOWED_PROOF_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
export type AllowedProofMimeType = (typeof ALLOWED_PROOF_MIME_TYPES)[number]

// Conservative cap: base64-encoding for the email attachment inflates size
// ~33%, so 8MB raw stays well under Resend's 40MB-per-email limit and
// Gmail/Google Workspace's ~25MB receiving limit, with headroom for the
// email's own HTML body and headers.
export const MAX_PROOF_FILE_SIZE_BYTES = 8 * 1024 * 1024

export class ProofFileValidationError extends Error {}

// Sniffs real file-signature bytes rather than trusting the client-declared
// MIME type alone -- a renamed/mislabeled executable or script claiming to
// be "image/png" is rejected here even if the browser's own File.type said
// otherwise. Returns the type this file's actual bytes match, or null if
// none of the four allowed signatures match.
function detectMimeTypeFromBytes(bytes: Uint8Array): AllowedProofMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // 'RIFF'
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // 'WEBP'
  )
    return 'image/webp'
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf' // '%PDF'
  return null
}

export interface ValidatedProofFile {
  fileName: string
  mimeType: AllowedProofMimeType
  size: number
  buffer: Buffer
}

// Throws ProofFileValidationError with a customer-safe message on any
// failure -- oversize, disallowed/unrecognized type, or a declared MIME
// type that doesn't match the file's real content. Never partially
// validates; a caller either gets a fully-trusted file back or an
// exception, nothing in between.
export function validateProofFile(fileName: string, declaredMimeType: string, buffer: Buffer): ValidatedProofFile {
  if (buffer.length === 0) {
    throw new ProofFileValidationError('The uploaded file is empty.')
  }
  if (buffer.length > MAX_PROOF_FILE_SIZE_BYTES) {
    throw new ProofFileValidationError(`File is too large -- please keep supporting proof under ${MAX_PROOF_FILE_SIZE_BYTES / (1024 * 1024)}MB.`)
  }

  const sniffed = detectMimeTypeFromBytes(buffer)
  if (!sniffed) {
    throw new ProofFileValidationError('Unsupported file type -- please upload a JPEG, PNG, WEBP image, or a PDF.')
  }
  // Defense against a MIME/content mismatch (e.g. an .exe renamed to
  // "proof.png" with a spoofed Content-Type header) -- the declared type
  // must agree with what the bytes actually are, not just be present.
  if (!ALLOWED_PROOF_MIME_TYPES.includes(declaredMimeType as AllowedProofMimeType) || declaredMimeType !== sniffed) {
    throw new ProofFileValidationError('The file content does not match its declared type -- please upload a genuine JPEG, PNG, WEBP, or PDF file.')
  }

  return { fileName: fileName.slice(0, 200), mimeType: sniffed, size: buffer.length, buffer }
}

// Human-readable, non-sequential customer-safe reference (PMR-YYYYMM-XXXXX)
// -- same random-suffix shape as lib/orders.ts's generateOrderNumber/
// generateInvoiceNumber, "or equivalent existing architecture" per the
// sprint's own instruction.
export function generatePriceMatchRequestNumber(): string {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `PMR-${ym}-${rand}`
}
