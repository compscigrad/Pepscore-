// Regression guard for the Clerk admin-authorization RBAC migration
// (2026-08-15): every route under app/api/admin/** must gate on the
// centralized requireAdmin() helper (lib/auth/rbac.ts) so a future route can
// never accidentally ship without it, and so the authorization logic itself
// can never drift between routes. Previously this grepped for the old
// per-route inline `function isAdmin(userId) { return userId ===
// process.env.ADMIN_CLERK_USER_ID }` pattern that requireAdmin() replaced;
// updated to check for the new pattern instead of the old one. whoami is
// the one deliberate exception -- it exists specifically to tell an
// authenticated non-admin "you are not the admin" without itself requiring
// admin, using the non-throwing isCurrentUserAdmin() boolean form, and it
// never returns anything beyond that boolean (see its own file comment).
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const ADMIN_API_DIR = join(__dirname)
const EXEMPT_FILES = new Set(['whoami/route.ts'])

function findRouteFiles(dir: string, base = ''): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const relPath = base ? `${base}/${entry}` : entry
    if (statSync(fullPath).isDirectory()) {
      files.push(...findRouteFiles(fullPath, relPath))
    } else if (/^route\.tsx?$/.test(entry)) {
      files.push(relPath)
    }
  }
  return files
}

describe('every admin API route enforces requireAdmin()', () => {
  const routeFiles = findRouteFiles(ADMIN_API_DIR)

  it('found at least the routes known at the time this guard was written', () => {
    // Not an exact count check (new routes are expected over time) — just a
    // sanity floor so a broken glob/readdir doesn't silently pass with zero.
    expect(routeFiles.length).toBeGreaterThanOrEqual(30)
  })

  for (const relPath of routeFiles) {
    if (EXEMPT_FILES.has(relPath)) continue

    it(`${relPath} imports and calls requireAdmin() before returning data`, () => {
      const content = readFileSync(join(ADMIN_API_DIR, relPath), 'utf-8')
      expect(content).toMatch(/import \{ requireAdmin \} from '@\/lib\/auth\/rbac'/)
      // At least one exported handler (GET/POST/PATCH/PUT/DELETE) must
      // actually call requireAdmin() -- not just import it unused -- and
      // gate on a falsy result before doing anything else.
      expect(content).toMatch(/const userId = await requireAdmin\(\)/)
      expect(content).toMatch(/if \(!userId\)/)
    })

    it(`${relPath} contains no leftover inline admin check`, () => {
      const content = readFileSync(join(ADMIN_API_DIR, relPath), 'utf-8')
      expect(content).not.toMatch(/process\.env\.ADMIN_CLERK_USER_ID/)
      expect(content).not.toMatch(/function isAdmin\(/)
    })
  }
})

describe('admin-only routes outside app/api/admin also use requireAdmin()', () => {
  // These two predate the app/api/admin/** convention and live elsewhere
  // (shipping label purchase, CPA export) but are admin-only in exactly the
  // same sense -- the glob above can't reach them since it's rooted at this
  // test file's own directory, so they're checked explicitly instead of
  // being silently uncovered.
  const OUTSIDE_ADMIN_ROUTES = ['../shipping/labels/route.ts', '../export/route.ts']

  for (const relPath of OUTSIDE_ADMIN_ROUTES) {
    it(`${relPath} imports and calls requireAdmin()`, () => {
      const content = readFileSync(join(ADMIN_API_DIR, relPath), 'utf-8')
      expect(content).toMatch(/import \{ requireAdmin \} from '@\/lib\/auth\/rbac'/)
      expect(content).toMatch(/const userId = await requireAdmin\(\)/)
      expect(content).not.toMatch(/process\.env\.ADMIN_CLERK_USER_ID/)
    })
  }
})
