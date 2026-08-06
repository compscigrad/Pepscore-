// Regression guard for the Clerk admin-authorization audit: every route
// under app/api/admin/** must gate on the same isAdmin(userId) pattern
// (userId === process.env.ADMIN_CLERK_USER_ID) so a future route can never
// accidentally ship without it. whoami is the one deliberate exception — it
// exists specifically to tell an authenticated non-admin "you are not the
// admin" without itself requiring admin, and it never returns anything
// beyond a boolean (see its own file comment).
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

describe('every admin API route enforces isAdmin()', () => {
  const routeFiles = findRouteFiles(ADMIN_API_DIR)

  it('found at least the routes known at the time this guard was written', () => {
    // Not an exact count check (new routes are expected over time) — just a
    // sanity floor so a broken glob/readdir doesn't silently pass with zero.
    expect(routeFiles.length).toBeGreaterThanOrEqual(30)
  })

  for (const relPath of routeFiles) {
    if (EXEMPT_FILES.has(relPath)) continue

    it(`${relPath} defines and calls isAdmin(userId) before returning data`, () => {
      const content = readFileSync(join(ADMIN_API_DIR, relPath), 'utf-8')
      expect(content).toMatch(/function isAdmin\(userId: string \| null\)/)
      expect(content).toMatch(/userId === process\.env\.ADMIN_CLERK_USER_ID/)
      // At least one exported handler (GET/POST/PATCH/PUT/DELETE) must
      // actually call isAdmin(...) — not just define the helper unused.
      const isAdminCallCount = (content.match(/isAdmin\(/g) ?? []).length
      expect(isAdminCallCount).toBeGreaterThanOrEqual(2) // 1 definition + >=1 call site
    })
  }
})
