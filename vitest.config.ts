import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    // Agent worktrees live inside .claude/worktrees/ (nested copies of this
    // repo) -- without this exclude, vitest's default glob picks up their
    // test files too and silently doubles/inflates every count.
    exclude: ['**/node_modules/**', '**/.claude/**'],
  },
})
