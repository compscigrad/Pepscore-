import { describe, it, expect } from 'vitest'
import { findLightThemeRegressions } from './check-admin-theme'

describe('admin dark theme regression guard', () => {
  it('has zero retired light-theme classes anywhere in app/admin/** or components/admin/**', () => {
    const hits = findLightThemeRegressions()
    if (hits.length > 0) {
      const summary = hits.map((h) => `${h.file}:${h.line}  ${h.text}`).join('\n')
      throw new Error(`Light-theme regression(s) found:\n${summary}`)
    }
    expect(hits).toEqual([])
  })
})
