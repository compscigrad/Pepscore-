import { describe, it, expect } from 'vitest'
import { explainCompound, buildPolicyCheckText } from './compoundExplainer'

describe('buildPolicyCheckText', () => {
  it('produces a plain research-area explainer sentence with no personal note', () => {
    expect(buildPolicyCheckText('NAD+')).toBe('Explain the research areas associated with NAD+.')
  })

  it('appends a personal-intent note when provided', () => {
    const text = buildPolicyCheckText('NAD+', 'and tell me how much I should take')
    expect(text).toContain('how much I should take')
  })
})

describe('explainCompound', () => {
  it('requires a non-empty product name', async () => {
    const result = await explainCompound('  ', 'CLIENT')
    expect(result.status).toBe('REFUSED')
    expect(result.entry).toBeNull()
  })

  it('refuses an explainer request carrying a personal-use intent, never reaching the database', async () => {
    const result = await explainCompound('NAD+', 'CLIENT', {
      personalIntentNote: 'what should I take for weight loss',
    })
    expect(result.status).toBe('REFUSED')
    expect(result.entry).toBeNull()
  })
})
