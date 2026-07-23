import { describe, it, expect } from 'vitest'
import { decideCustomerIdentityAction } from './customerIdentity'

describe('decideCustomerIdentityAction', () => {
  it('links the existing Customer when exactly one unclaimed match exists', () => {
    const action = decideCustomerIdentityAction({
      alreadyLinked: false,
      emailMatches: [{ id: 'cust_1', userId: null }],
    })
    expect(action).toEqual({ type: 'LINK_EXISTING', customerId: 'cust_1' })
  })

  it('creates a new Customer when no match exists', () => {
    const action = decideCustomerIdentityAction({
      alreadyLinked: false,
      emailMatches: [],
    })
    expect(action).toEqual({ type: 'CREATE_NEW' })
  })

  it('is idempotent — an already-linked User never gets re-matched or re-created', () => {
    const action = decideCustomerIdentityAction({
      alreadyLinked: true,
      // Even if unrelated unclaimed matches exist, ALREADY_LINKED wins outright.
      emailMatches: [{ id: 'cust_1', userId: null }],
    })
    expect(action).toEqual({ type: 'ALREADY_LINKED' })
  })

  it('never guesses across multiple unclaimed matches — surfaces AMBIGUOUS instead', () => {
    const action = decideCustomerIdentityAction({
      alreadyLinked: false,
      emailMatches: [
        { id: 'cust_1', userId: null },
        { id: 'cust_2', userId: null },
      ],
    })
    expect(action).toEqual({ type: 'AMBIGUOUS', matchingCustomerIds: ['cust_1', 'cust_2'] })
  })

  it('never lets a User claim a Customer already linked to a different User', () => {
    const action = decideCustomerIdentityAction({
      alreadyLinked: false,
      emailMatches: [{ id: 'cust_1', userId: 'user_other' }],
    })
    // The only "match" is already claimed by someone else, so it's excluded
    // entirely — this falls through to CREATE_NEW, never LINK_EXISTING onto
    // someone else's record.
    expect(action).toEqual({ type: 'CREATE_NEW' })
  })

  it('excludes an already-claimed match but still surfaces AMBIGUOUS if 2+ unclaimed remain', () => {
    const action = decideCustomerIdentityAction({
      alreadyLinked: false,
      emailMatches: [
        { id: 'cust_claimed', userId: 'user_other' },
        { id: 'cust_1', userId: null },
        { id: 'cust_2', userId: null },
      ],
    })
    expect(action).toEqual({ type: 'AMBIGUOUS', matchingCustomerIds: ['cust_1', 'cust_2'] })
  })
})
