// Regression guard for the Customer Portal authorization re-audit (Auth
// Sprint P5): every route under app/api/account/** and every page under
// app/account/** must resolve the authenticated customer server-side via
// getPortalCustomer()/getPortalAuthState() — never trust a client-supplied
// id alone. Mirrors app/api/admin/adminAuthCoverage.test.ts's shape for the
// admin surface, applied to the customer-portal trust boundary.
//
// A dynamic [id] route additionally must scope its ownership lookup by the
// resolved customer's own id (customerId: customer.id) — an id alone must
// never establish ownership. This is checked heuristically (the literal
// substring must appear), which is intentionally strict: a route that
// looks up by id without visibly re-deriving ownership from the
// authenticated customer should fail this guard and be reviewed by hand,
// not silently pass.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

function findFiles(dir: string, matcher: RegExp, base = ''): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const relPath = base ? `${base}/${entry}` : entry
    if (statSync(fullPath).isDirectory()) {
      files.push(...findFiles(fullPath, matcher, relPath))
    } else if (matcher.test(entry)) {
      files.push(relPath)
    }
  }
  return files
}

const API_DIR = join(__dirname)
const AUTH_CALL = /getPortalCustomer\(|getPortalAuthState\(/

// The claim route is the one deliberate exception: by definition it runs
// before any Customer is linked, so it can't gate on getPortalCustomer()/
// getPortalAuthState(). Its own equivalent boundary — isPortalEnabled() +
// auth() + Clerk's server-verified primary email matched against the
// invited Customer's email — is exercised by lib/portalInvites.test.ts.
const EXEMPT_ROUTES = new Set(['claim/[token]/route.ts'])

describe('every app/api/account/** route resolves the customer server-side', () => {
  const routeFiles = findFiles(API_DIR, /^route\.tsx?$/)

  it('found at least the routes known at the time this guard was written', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(5)
  })

  for (const relPath of routeFiles) {
    if (EXEMPT_ROUTES.has(relPath)) continue

    it(`${relPath} calls getPortalCustomer() or getPortalAuthState() before returning data`, () => {
      const content = readFileSync(join(API_DIR, relPath), 'utf-8')
      expect(content).toMatch(AUTH_CALL)
    })

    if (relPath.includes('[id]')) {
      it(`${relPath} scopes its [id] lookup by the resolved customer's own id, not the id alone`, () => {
        const content = readFileSync(join(API_DIR, relPath), 'utf-8')
        expect(content).toMatch(/customerId:\s*customer\.id|customerId\s*!==\s*customer\.id/)
      })
    }
  }
})

const ACCOUNT_PAGES_DIR = join(__dirname, '..', '..', '..', 'app', 'account')

describe('every app/account/** page resolves the customer server-side', () => {
  const pageFiles = findFiles(ACCOUNT_PAGES_DIR, /^page\.tsx$/)

  it('found at least the pages known at the time this guard was written', () => {
    expect(pageFiles.length).toBeGreaterThanOrEqual(6)
  })

  for (const relPath of pageFiles) {
    // The claim page is the one deliberate exception — it exists precisely
    // to let an authenticated-but-not-yet-linked Clerk user claim an
    // invite, so it cannot require an already-resolved Customer first.
    if (relPath.startsWith('claim/')) continue

    it(`${relPath} calls getPortalAuthState() (or getPortalCustomer()) before rendering customer data`, () => {
      const content = readFileSync(join(ACCOUNT_PAGES_DIR, relPath), 'utf-8')
      expect(content).toMatch(AUTH_CALL)
    })
  }
})
