// Pure decision logic for lib/customers.ts's resolveCustomerForUser — kept
// DB-free so every branch, including the "never guess on ambiguous matches"
// and "never reassign a Customer already linked to a different User" rules,
// is unit-testable without a database. Mirrors lib/intakeLinkState.ts's
// pattern of a pure state-decision function called from the I/O layer.

export interface CandidateCustomer {
  id: string
  userId: string | null
}

export type CustomerIdentityAction =
  | { type: 'ALREADY_LINKED' }
  | { type: 'LINK_EXISTING'; customerId: string }
  | { type: 'CREATE_NEW' }
  | { type: 'AMBIGUOUS'; matchingCustomerIds: string[] }

export function decideCustomerIdentityAction(input: {
  alreadyLinked: boolean
  emailMatches: CandidateCustomer[]
}): CustomerIdentityAction {
  if (input.alreadyLinked) return { type: 'ALREADY_LINKED' }

  // A Customer already linked to a different User is never a candidate —
  // this is the "another User cannot claim an already-linked Customer" rule,
  // enforced here in addition to Customer.userId's unique DB constraint.
  const unclaimed = input.emailMatches.filter(c => c.userId === null)

  if (unclaimed.length > 1) {
    return { type: 'AMBIGUOUS', matchingCustomerIds: unclaimed.map(c => c.id) }
  }
  if (unclaimed.length === 1) {
    return { type: 'LINK_EXISTING', customerId: unclaimed[0].id }
  }
  return { type: 'CREATE_NEW' }
}
