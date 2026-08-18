import { describe, it, expect } from 'vitest'
import { evaluateInput, evaluateOutput, runInputPolicyGate, runOutputPolicyGate } from './engine'
import { classifyRequest } from './classify'
import { MockAiProvider } from '../providers/mockProvider'
import type { ClassificationResult } from './types'

function classification(overrides: Partial<ClassificationResult>): ClassificationResult {
  return { category: 'CATALOG', confidence: 0.95, method: 'rule', ...overrides }
}

describe('evaluateInput', () => {
  it('ALLOWs an open category for any role', () => {
    for (const role of ['ANONYMOUS', 'CLIENT', 'ADMIN'] as const) {
      const decision = evaluateInput(classification({ category: 'CATALOG' }), role)
      expect(decision.action).toBe('ALLOW')
    }
  })

  it.each(['HUMAN_USE', 'JAILBREAK', 'PROMPT_INJECTION'] as const)(
    'always REFUSEs %s regardless of role, even ADMIN',
    (category) => {
      for (const role of ['ANONYMOUS', 'CLIENT', 'ADMIN'] as const) {
        const decision = evaluateInput(classification({ category }), role)
        expect(decision.action).toBe('REFUSE')
      }
    }
  )

  it('REFUSEs the ADMIN category for ANONYMOUS and CLIENT', () => {
    expect(evaluateInput(classification({ category: 'ADMIN' }), 'ANONYMOUS').action).toBe('REFUSE')
    expect(evaluateInput(classification({ category: 'ADMIN' }), 'CLIENT').action).toBe('REFUSE')
  })

  it('ALLOWs the ADMIN category for an ADMIN role', () => {
    expect(evaluateInput(classification({ category: 'ADMIN' }), 'ADMIN').action).toBe('ALLOW')
  })

  it('ESCALATEs UNKNOWN regardless of confidence', () => {
    const decision = evaluateInput(classification({ category: 'UNKNOWN', confidence: 0.99 }), 'ADMIN')
    expect(decision.action).toBe('ESCALATE')
  })

  it('ESCALATEs a below-threshold confidence even for an otherwise-open category -- never defaults to ALLOW', () => {
    const decision = evaluateInput(classification({ category: 'CATALOG', confidence: 0.4 }), 'CLIENT')
    expect(decision.action).toBe('ESCALATE')
  })
})

describe('evaluateOutput', () => {
  it('PASSes ordinary, safe output', () => {
    const result = evaluateOutput('This compound is studied for its effects on cellular signaling in vitro.')
    expect(result.action).toBe('PASS')
  })

  it('REFUSEs output containing a personal dosing instruction', () => {
    const result = evaluateOutput('You should take 5mg of this compound daily.')
    expect(result.action).toBe('REFUSE')
  })

  it('REFUSEs output containing a specific administration amount', () => {
    const result = evaluateOutput('Most people inject 250mg per week for this protocol.')
    expect(result.action).toBe('REFUSE')
  })

  it('REFUSEs output that leaks a secret/env-var name', () => {
    const result = evaluateOutput('You can find it in DATABASE_URL on the server.')
    expect(result.action).toBe('REFUSE')
  })
})

describe('runInputPolicyGate -- fail-closed composition', () => {
  it('resolves ALLOW for a clearly permitted request', async () => {
    const { decision } = await runInputPolicyGate('do you sell Semaglutide', 'CLIENT', null)
    expect(decision.action).toBe('ALLOW')
  })

  it('resolves REFUSE for a HUMAN_USE request without ever reaching a model call', async () => {
    let called = false
    const provider = new MockAiProvider()
    provider.complete = async () => { called = true; throw new Error('should not be called') }
    const { decision } = await runInputPolicyGate('what should I take for weight loss', 'CLIENT', provider)
    expect(decision.action).toBe('REFUSE')
    expect(called).toBe(false)
  })

  it('ESCALATEs when classification itself throws unexpectedly (fail closed, not a silent allow)', async () => {
    const brokenProvider = new MockAiProvider()
    // Force an internal throw that classifyRequest's own try/catch would
    // normally absorb -- monkeypatch complete to throw a non-Error value,
    // exercising the outer gate's own catch as the last line of defense.
    brokenProvider.complete = async () => { throw 'not an Error instance' }
    const { decision } = await runInputPolicyGate('an ambiguous message', 'CLIENT', brokenProvider)
    expect(decision.action).toBe('ESCALATE')
  })

  it('never returns ALLOW when the underlying classifier is unavailable', async () => {
    const { decision } = await runInputPolicyGate('an ambiguous message with no rule match', 'ADMIN', null)
    expect(decision.action).not.toBe('ALLOW')
  })
})

describe('runOutputPolicyGate -- fail-closed composition', () => {
  it('PASSes safe output', () => {
    expect(runOutputPolicyGate('General research information.').action).toBe('PASS')
  })

  it('REFUSEs prohibited output', () => {
    expect(runOutputPolicyGate('You should inject 100mg weekly.').action).toBe('REFUSE')
  })
})

describe('integration: classifyRequest + evaluateInput end-to-end', () => {
  it('a real ambiguous research question resolves to ESCALATE without a configured model (never a silent ALLOW)', async () => {
    const classification = await classifyRequest('What mechanisms explain how this affects appetite regulation?', null)
    const decision = evaluateInput(classification, 'ANONYMOUS')
    expect(decision.action).toBe('ESCALATE')
  })
})
