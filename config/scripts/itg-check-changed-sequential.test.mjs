import { describe, expect, it } from 'vitest'
import { rewriteSiblingImports } from './itg-check-changed-sequential.mjs'

describe('rewriteSiblingImports', () => {
  it('points static and dynamic sibling imports at the scripts folder, leaving packages alone', () => {
    const source = [
      "import { planChangedChecks } from './check-changed-selection.mjs'",
      "const { run } = await import('./pinned-bun-executable.mjs')",
      "const host = await import('@orca/process-host')"
    ].join('\n')

    expect(rewriteSiblingImports(source, 'file:///repo/config/scripts')).toBe(
      [
        "import { planChangedChecks } from 'file:///repo/config/scripts/check-changed-selection.mjs'",
        "const { run } = await import('file:///repo/config/scripts/pinned-bun-executable.mjs')",
        "const host = await import('@orca/process-host')"
      ].join('\n')
    )
  })
})
