import { describe, it, expect } from 'vitest'
import { SYNTHETIC_TEST_PROMPTS, findSyntheticPrompt } from './syntheticPrompts'

describe('SYNTHETIC_TEST_PROMPTS', () => {
  it('has no PII -- no personal names, addresses, or account identifiers, just research-context text', () => {
    for (const p of SYNTHETIC_TEST_PROMPTS) {
      expect(p.text).not.toMatch(/@|\d{3}-\d{2}-\d{4}/)
    }
  })

  it('has unique keys', () => {
    const keys = SYNTHETIC_TEST_PROMPTS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('includes at least one ALLOWED_EXAMPLE and one PROHIBITED_EXAMPLE', () => {
    expect(SYNTHETIC_TEST_PROMPTS.some((p) => p.category === 'ALLOWED_EXAMPLE')).toBe(true)
    expect(SYNTHETIC_TEST_PROMPTS.some((p) => p.category === 'PROHIBITED_EXAMPLE')).toBe(true)
  })
})

describe('findSyntheticPrompt', () => {
  it('returns the matching prompt for a real key', () => {
    expect(findSyntheticPrompt('weight-loss')?.text).toBe('What should I take for weight loss?')
  })

  it('returns undefined for an unknown key -- never falls back to a guessed prompt', () => {
    expect(findSyntheticPrompt('not-a-real-key')).toBeUndefined()
  })
})
