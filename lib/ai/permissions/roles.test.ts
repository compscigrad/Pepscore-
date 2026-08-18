import { describe, it, expect } from 'vitest'
import { resolveAiRole, roleMeetsMinimum, categoryRequiresRole } from './roles'

describe('resolveAiRole', () => {
  it('resolves ADMIN when isAdmin is true, regardless of authentication', () => {
    expect(resolveAiRole(true, true)).toBe('ADMIN')
    expect(resolveAiRole(true, false)).toBe('ADMIN')
  })

  it('resolves CLIENT when authenticated but not admin', () => {
    expect(resolveAiRole(false, true)).toBe('CLIENT')
  })

  it('resolves ANONYMOUS when neither admin nor authenticated', () => {
    expect(resolveAiRole(false, false)).toBe('ANONYMOUS')
  })
})

describe('roleMeetsMinimum', () => {
  it('ranks ANONYMOUS < CLIENT < ADMIN', () => {
    expect(roleMeetsMinimum('ANONYMOUS', 'CLIENT')).toBe(false)
    expect(roleMeetsMinimum('CLIENT', 'ADMIN')).toBe(false)
    expect(roleMeetsMinimum('ADMIN', 'CLIENT')).toBe(true)
    expect(roleMeetsMinimum('CLIENT', 'CLIENT')).toBe(true)
  })
})

describe('categoryRequiresRole', () => {
  it('requires ADMIN for the ADMIN category', () => {
    expect(categoryRequiresRole('ADMIN')).toBe('ADMIN')
  })

  it('has no role floor for open categories', () => {
    expect(categoryRequiresRole('CATALOG')).toBeNull()
    expect(categoryRequiresRole('RESEARCH')).toBeNull()
  })
})
