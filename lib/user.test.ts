import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { isUniqueConstraintViolation } from './user'

// Exercises the exact error shape Prisma throws for a P2002 -- the race
// condition this module exists to absorb (two concurrent upserts for a
// brand-new Clerk user; see this file's header comment and the PR7
// disposable rehearsal script, which proves the real end-to-end fix
// against actual concurrent DB writes).
function makeP2002(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
    meta: { target },
  })
}

describe('isUniqueConstraintViolation', () => {
  it('recognizes a P2002 on the given field', () => {
    expect(isUniqueConstraintViolation(makeP2002(['clerkId']), 'clerkId')).toBe(true)
  })

  it('does not match a P2002 on a different field', () => {
    expect(isUniqueConstraintViolation(makeP2002(['email']), 'clerkId')).toBe(false)
  })

  it('does not match a P2002 on a compound constraint that omits the field', () => {
    expect(isUniqueConstraintViolation(makeP2002(['someOtherField']), 'clerkId')).toBe(false)
  })

  it('matches when the field is one of several in a compound constraint', () => {
    expect(isUniqueConstraintViolation(makeP2002(['clerkId', 'otherField']), 'clerkId')).toBe(true)
  })

  it('does not match a non-Prisma error', () => {
    expect(isUniqueConstraintViolation(new Error('boom'), 'clerkId')).toBe(false)
  })

  it('does not match a different Prisma error code', () => {
    const notFound = new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: '5.22.0' })
    expect(isUniqueConstraintViolation(notFound, 'clerkId')).toBe(false)
  })
})
