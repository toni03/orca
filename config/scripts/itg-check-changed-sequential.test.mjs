import { describe, expect, it } from 'vitest'
import { rewriteSiblingImports } from './itg-check-changed-sequential.mjs'

describe('rewriteSiblingImports', () => {
  it('points static and dynamic sibling imports at the scripts folder, leaving packages alone', () => {
    const source = [
      "import { planChangedChecks } from './check-changed-selection.mjs'",
      "const { run } = await import('../../tool-invocation/pinned-bun-executable.mjs')",
      "const host = await import('@orca/process-host')"
    ].join('\n')

    expect(
      rewriteSiblingImports(source, 'file:///repo/config/scripts/preflight/changed-checks')
    ).toBe(
      [
        "import { planChangedChecks } from 'file:///repo/config/scripts/preflight/changed-checks/check-changed-selection.mjs'",
        "const { run } = await import('file:///repo/config/scripts/tool-invocation/pinned-bun-executable.mjs')",
        "const host = await import('@orca/process-host')"
      ].join('\n')
    )
  })
})
