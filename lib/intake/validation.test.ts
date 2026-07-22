import { describe, it, expect } from 'vitest'
import { intakeSubmissionSchema, isHoneypotTripped } from './validation'

const base = {
  firstName: 'Marvin',
  lastName: 'Alexander',
  email: 'marvin@example.com',
}

describe('intakeSubmissionSchema', () => {
  it('accepts a minimal valid submission with just an email', () => {
    expect(intakeSubmissionSchema.safeParse(base).success).toBe(true)
  })

  it('accepts a minimal valid submission with just a phone', () => {
    const result = intakeSubmissionSchema.safeParse({ firstName: 'Marvin', lastName: 'Alexander', phone: '2024253161' })
    expect(result.success).toBe(true)
  })

  it('rejects a submission with neither email nor phone', () => {
    const result = intakeSubmissionSchema.safeParse({ firstName: 'Marvin', lastName: 'Alexander' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing first or last name', () => {
    expect(intakeSubmissionSchema.safeParse({ ...base, firstName: '' }).success).toBe(false)
    expect(intakeSubmissionSchema.safeParse({ ...base, lastName: '' }).success).toBe(false)
  })

  it('rejects an invalid email', () => {
    expect(intakeSubmissionSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects a malformed ZIP in a provided address', () => {
    const result = intakeSubmissionSchema.safeParse({
      ...base,
      billingAddress: { street1: '1 Main St', city: 'DC', state: 'DC', zip: 'abc' },
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid full address', () => {
    const result = intakeSubmissionSchema.safeParse({
      ...base,
      billingAddress: { street1: '1 Main St', city: 'Washington', state: 'DC', zip: '20001' },
    })
    expect(result.success).toBe(true)
  })
})

describe('isHoneypotTripped', () => {
  it('is false when the honeypot field is empty', () => {
    expect(isHoneypotTripped({ website: '' })).toBe(false)
    expect(isHoneypotTripped({})).toBe(false)
  })

  it('is true when the honeypot field is filled', () => {
    expect(isHoneypotTripped({ website: 'https://spam.example.com' })).toBe(true)
  })
})
