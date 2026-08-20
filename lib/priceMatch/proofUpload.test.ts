import { describe, it, expect } from 'vitest'
import { validateProofFile, generatePriceMatchRequestNumber, MAX_PROOF_FILE_SIZE_BYTES, ProofFileValidationError } from './proofUpload'

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const WEBP_HEADER = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
const PDF_HEADER = Buffer.from('%PDF-1.4 rest of file')
const ELF_HEADER = Buffer.from([0x7f, 0x45, 0x4c, 0x46]) // a Linux executable -- must always be rejected

describe('validateProofFile', () => {
  it('accepts a genuine JPEG', () => {
    const result = validateProofFile('proof.jpg', 'image/jpeg', JPEG_HEADER)
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.size).toBe(JPEG_HEADER.length)
  })

  it('accepts a genuine PNG', () => {
    const result = validateProofFile('proof.png', 'image/png', PNG_HEADER)
    expect(result.mimeType).toBe('image/png')
  })

  it('accepts a genuine WEBP', () => {
    const result = validateProofFile('proof.webp', 'image/webp', WEBP_HEADER)
    expect(result.mimeType).toBe('image/webp')
  })

  it('accepts a genuine PDF', () => {
    const result = validateProofFile('quote.pdf', 'application/pdf', PDF_HEADER)
    expect(result.mimeType).toBe('application/pdf')
  })

  it('rejects an empty file', () => {
    expect(() => validateProofFile('empty.jpg', 'image/jpeg', Buffer.alloc(0))).toThrow(ProofFileValidationError)
  })

  it('rejects a file over the size limit', () => {
    const oversized = Buffer.concat([JPEG_HEADER, Buffer.alloc(MAX_PROOF_FILE_SIZE_BYTES)])
    expect(() => validateProofFile('big.jpg', 'image/jpeg', oversized)).toThrow(/too large/)
  })

  it('rejects an executable regardless of declared filename/MIME type', () => {
    expect(() => validateProofFile('proof.png', 'image/png', ELF_HEADER)).toThrow(ProofFileValidationError)
  })

  it('rejects an unrecognized file type entirely', () => {
    expect(() => validateProofFile('archive.zip', 'application/zip', Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toThrow(/Unsupported file type/)
  })

  it('rejects a declared MIME type that does not match the real file content (MIME/content mismatch)', () => {
    // Real bytes are a PNG, but the declared type claims PDF.
    expect(() => validateProofFile('sneaky.pdf', 'application/pdf', PNG_HEADER)).toThrow(/does not match its declared type/)
  })

  it('rejects a disallowed declared MIME type even if the bytes happen to sniff as something allowed', () => {
    // Real bytes are a genuine JPEG, but the caller declared a type outside the allowlist.
    expect(() => validateProofFile('proof.jpg', 'image/gif', JPEG_HEADER)).toThrow(/does not match its declared type/)
  })
})

describe('generatePriceMatchRequestNumber', () => {
  it('produces a PMR-prefixed, year-month-stamped, non-sequential reference', () => {
    const now = new Date()
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const id = generatePriceMatchRequestNumber()
    expect(id).toMatch(new RegExp(`^PMR-${ym}-[A-Z0-9]{5}$`))
  })

  it('generates distinct values across calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generatePriceMatchRequestNumber()))
    expect(ids.size).toBeGreaterThan(1)
  })
})
