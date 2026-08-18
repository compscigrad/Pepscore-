// Regression guard for admin PAGE auth (companion to
// app/api/admin/adminAuthCoverage.test.ts, which already covers every
// admin API route). AI-0A audit (2026-08-17) found API routes fully
// covered by that existing test, but no equivalent guard for the 26
// app/admin/**/page.tsx files -- app/admin/layout.tsx deliberately does
// NOT gate auth itself (see its own file comment: "Auth stays per-page"),
// so a future new admin page could ship without the check and nothing
// would catch it. This closes that gap the same way: every page.tsx
// under app/admin/** must import isCurrentUserAdmin() from
// lib/auth/rbac.ts and gate on it before rendering real content.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const ADMIN_DIR = join(__dirname)

function findPageFiles(dir: string, base = ''): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const relPath = base ? `${base}/${entry}` : entry
    if (statSync(fullPath).isDirectory()) {
      files.push(...findPageFiles(fullPath, relPath))
    } else if (entry === 'page.tsx') {
      files.push(relPath)
    }
  }
  return files
}

describe('every admin page enforces isCurrentUserAdmin()', () => {
  const pageFiles = findPageFiles(ADMIN_DIR)

  it('found at least the pages known at the time this guard was written', () => {
    // Sanity floor, not an exact count -- new admin pages are expected
    // over time (mirrors the API route guard's own floor check).
    expect(pageFiles.length).toBeGreaterThanOrEqual(20)
  })

  for (const relPath of pageFiles) {
    it(`${relPath} imports and gates on isCurrentUserAdmin()`, () => {
      const content = readFileSync(join(ADMIN_DIR, relPath), 'utf-8')
      expect(content).toMatch(/import \{ isCurrentUserAdmin \} from '@\/lib\/auth\/rbac'/)
      expect(content).toMatch(/if \(!\(await isCurrentUserAdmin\(\)\)\)/)
    })

    it(`${relPath} contains no leftover inline admin check`, () => {
      const content = readFileSync(join(ADMIN_DIR, relPath), 'utf-8')
      expect(content).not.toMatch(/process\.env\.ADMIN_CLERK_USER_ID/)
    })
  }
})
