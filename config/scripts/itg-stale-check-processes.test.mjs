import { describe, expect, it } from 'vitest'
import { findSessionWorkerTrees, findStaleProcessTrees } from './itg-stale-check-processes.mjs'

const proc = (name, pid, ppid, ageSeconds) => ({ name, pid, ppid, ageSeconds })
const roots = (processes) => findStaleProcessTrees(processes).map(({ root }) => root.pid)

describe('findStaleProcessTrees', () => {
  it('stops a check whose agent shell is gone at its topmost surviving launcher', () => {
    const processes = [
      proc('sh', 10, 9, 600),
      proc('pnpm', 11, 10, 600),
      proc('node', 12, 11, 590),
      proc('bun', 13, 12, 500)
    ]
    expect(findStaleProcessTrees(processes)).toEqual([{ root: processes[0], tree: processes }])
  })

  it('keeps an agent TypeScript server whose session is alive', () => {
    expect(
      roots([proc('claude', 20, 1, 9000), proc('node', 21, 20, 800), proc('tsc', 22, 21, 800)])
    ).toEqual([])
  })

  it('keeps a desktop root that happens to have heavy descendants', () => {
    expect(
      roots([proc('explorer', 30, 3, 9000), proc('Orca', 31, 30, 8000), proc('bun', 32, 31, 60)])
    ).toEqual([])
  })

  it('treats a parent PID reused by a younger process as gone', () => {
    expect(
      roots([proc('cmd', 40, 41, 900), proc('node', 41, 1, 30), proc('tsgolint', 42, 40, 800)])
    ).toEqual([40])
  })

  it('leaves a shell with no heavy workers alone', () => {
    expect(roots([proc('bash', 50, 49, 900), proc('git', 51, 50, 5)])).toEqual([])
  })
})

describe('findSessionWorkerTrees', () => {
  const sessionRoots = (processes, selfPid) =>
    findSessionWorkerTrees(processes, selfPid).map(({ root }) => root.pid)
  const orca = proc('Orca', 1, 0, 9000)
  const claude = proc('claude', 2, 1, 8000)
  const self = [proc('bash', 3, 2, 10), proc('node', 4, 3, 1)]

  it('selects the calling session TypeScript server and running checks', () => {
    const lsp = [proc('node', 10, 2, 500), proc('tsc', 11, 10, 500)]
    const check = [proc('sh', 20, 2, 300), proc('node', 21, 20, 300), proc('bun', 22, 21, 290)]
    expect(sessionRoots([orca, claude, ...self, ...lsp, ...check], 4)).toEqual([11, 22])
  })

  it('starts from the parent when the snapshot missed the calling process', () => {
    const lsp = [proc('node', 10, 2, 500), proc('tsc', 11, 10, 500)]
    const found = findSessionWorkerTrees([orca, claude, self[0], ...lsp], 99, 3)
    expect(found.map(({ root }) => root.pid)).toEqual([11])
  })

  it('leaves the workers of other sessions alone', () => {
    const other = [proc('claude', 30, 1, 7000), proc('tsc', 31, 30, 600)]
    expect(sessionRoots([orca, claude, ...self, ...other], 4)).toEqual([])
  })

  it('selects nothing outside an agent session', () => {
    expect(sessionRoots([orca, proc('bash', 3, 1, 10), proc('tsc', 5, 1, 60)], 3)).toEqual([])
  })
})
