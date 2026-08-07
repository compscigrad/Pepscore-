import { describe, it, expect } from 'vitest'
import { shouldRedirectAdminToAdminDashboard, isAdminViewingCustomerPortal } from './accountRouting'

// Regression coverage for the production bug: clicking "Customer Portal"
// while already signed in as the admin landed on /admin instead of the
// customer sign-in/setup flow. Portal intent must be determined by the
// button clicked (customerIntent), never inferred from the session's role.
describe('shouldRedirectAdminToAdminDashboard', () => {
  it('an authenticated admin clicking Admin Sign In (no customer intent) reaches /admin', () => {
    expect(shouldRedirectAdminToAdminDashboard(true, false)).toBe(true)
  })

  it('an authenticated admin clicking Customer Portal (explicit customer intent) does NOT redirect to /admin', () => {
    expect(shouldRedirectAdminToAdminDashboard(true, true)).toBe(false)
  })

  it('a non-admin session is never redirected to /admin, regardless of intent', () => {
    expect(shouldRedirectAdminToAdminDashboard(false, false)).toBe(false)
    expect(shouldRedirectAdminToAdminDashboard(false, true)).toBe(false)
  })

  it('a stale admin bookmark to /account (no explicit customer intent) still bounces to /admin -- the original safeguard is preserved', () => {
    expect(shouldRedirectAdminToAdminDashboard(true, false)).toBe(true)
  })
})

describe('isAdminViewingCustomerPortal', () => {
  it('an authenticated admin clicking Customer Portal sees the customer login/setup flow, not /admin', () => {
    expect(isAdminViewingCustomerPortal(true, true)).toBe(true)
  })

  it('a customer clicking Customer Portal is not treated as the admin-viewing-customer-portal case', () => {
    expect(isAdminViewingCustomerPortal(false, true)).toBe(false)
  })

  it('an admin with no customer intent is not shown the customer-portal admin-session message (falls through to the /admin redirect instead)', () => {
    expect(isAdminViewingCustomerPortal(true, false)).toBe(false)
  })

  it('remembered sessions do not hijack the selected portal intent: same admin session, different intent, different outcome', () => {
    // Admin Sign In click -- no customer intent -- goes to /admin
    expect(shouldRedirectAdminToAdminDashboard(true, false)).toBe(true)
    expect(isAdminViewingCustomerPortal(true, false)).toBe(false)
    // Customer Portal click -- same admin session -- goes to customer flow instead
    expect(shouldRedirectAdminToAdminDashboard(true, true)).toBe(false)
    expect(isAdminViewingCustomerPortal(true, true)).toBe(true)
  })
})
