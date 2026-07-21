// eslint-config-next@16 ships native ESLint 9 flat-config arrays directly
// (see node_modules/eslint-config-next/dist/{core-web-vitals,typescript}.js).
// The previous version of this file routed them through FlatCompat.extends(),
// which is a shim for *legacy* eslintrc-style shareable configs. Passing
// already-flat, self-referencing plugin objects through that legacy JSON
// schema validator crashed with "Converting circular structure to JSON" —
// FlatCompat was never meant to wrap configs that are already flat. Since
// `next lint` doesn't exist in Next.js 16 (removed in favor of running
// ESLint directly), this file needs to work standalone with `npx eslint .`,
// so importing the flat exports directly is the correct fix, not a workaround.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Allow unused vars prefixed with _ (e.g., _unused)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
]

export default eslintConfig
