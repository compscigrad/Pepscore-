// Regression guard for the admin dark PepScore Lab theme migration
// (2026-08-07). Not a unit test in the vitest sense -- a repo-wide grep
// sweep run as a script (and from lib/adminTheme.test.ts below) so a
// future admin page/component can't silently reintroduce the retired
// light/cream classes without a build-time signal. The only allowed
// exception is a raw <option> element's className, which intentionally
// keeps `bg-white text-dark` -- OS-rendered <select> popups don't
// reliably honor a dark background cross-browser (see
// components/invoices/theme.ts's selectOption token comment).
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const BANNED_PATTERNS = [
  /\btext-dark\b/,
  /\bbg-g100\b/,
  /\btext-g500\b/,
  /\btext-g700\b/,
  /\btext-g300\b/,
  /\bborder-g100\b/,
  /\bborder-g300\b/,
  /\bshadow-sh\b/,
  /\bshadow-sl\b/,
  /\bshadow-sm2\b/,
  /\bbg-cream\b/,
]

const SCAN_ROOTS = [join(__dirname, '..', 'app', 'admin'), join(__dirname, '..', 'components', 'admin')]

function isOptionExceptionLine(line: string): boolean {
  return /<option\b/.test(line) && /bg-white text-dark/.test(line)
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, files)
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) files.push(full)
  }
  return files
}

export function findLightThemeRegressions(): Array<{ file: string; line: number; text: string }> {
  const hits: Array<{ file: string; line: number; text: string }> = []
  for (const root of SCAN_ROOTS) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, 'utf-8').split('\n')
      lines.forEach((line, i) => {
        if (isOptionExceptionLine(line)) return
        if (BANNED_PATTERNS.some((p) => p.test(line))) {
          hits.push({ file, line: i + 1, text: line.trim() })
        }
      })
    }
  }
  return hits
}

if (require.main === module) {
  const hits = findLightThemeRegressions()
  if (hits.length > 0) {
    console.error(`Found ${hits.length} light-theme regression(s) in admin surfaces:`)
    for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.text}`)
    process.exit(1)
  }
  console.log('No light-theme regressions found in app/admin/** or components/admin/**.')
}
