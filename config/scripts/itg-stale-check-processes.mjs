#!/usr/bin/env node
// Lists, or with --kill stops, check process trees whose launching shell is gone. Windows does not
// stop children with their parent, so a check:changed whose agent shell ended keeps its bun,
// tsgolint and tsc workers (several GB each) running with nobody reading the result.
// --session instead targets the workers of the calling agent session, for it to run when it ends.
// Usage: node config/scripts/itg-stale-check-processes.mjs [--session] [--kill]
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const HEAVY = new Set(['bun', 'tsgolint', 'tsc'])
const LAUNCHERS = new Set(['sh', 'bash', 'cmd', 'pnpm', 'node'])
const SESSION = 'claude'

// typeperf only takes the counter names of the system language.
const COUNTER_SETS = [
  {
    object: 'Proceso',
    pid: 'Id. de proceso',
    ppid: 'Id. de proceso de creación',
    age: 'Tiempo transcurrido'
  },
  { object: 'Process', pid: 'ID Process', ppid: 'Creating Process ID', age: 'Elapsed Time' }
]

/** @typedef {{ name: string, pid: number, ppid: number, ageSeconds: number }} ProcessEntry */

/** @param {ProcessEntry[]} processes */
function indexProcesses(processes) {
  const byPid = new Map(processes.map((entry) => [entry.pid, entry]))
  const children = new Map()
  for (const entry of processes) {
    children.set(entry.ppid, [...(children.get(entry.ppid) ?? []), entry])
  }
  // A younger process cannot be the parent of an older one: that PID was reused.
  const parentOf = (entry) => {
    const parent = byPid.get(entry.ppid)
    return parent && parent.ageSeconds >= entry.ageSeconds ? parent : undefined
  }
  const descendants = (root) => {
    const out = []
    const queue = [...(children.get(root.pid) ?? [])]
    while (queue.length > 0) {
      const entry = queue.shift()
      if (entry.ageSeconds > root.ageSeconds || out.includes(entry)) {
        continue
      }
      out.push(entry)
      queue.push(
        ...(children.get(entry.pid) ?? []).filter((child) => child.ageSeconds <= entry.ageSeconds)
      )
    }
    return out
  }
  return { byPid, parentOf, descendants }
}

/** @param {ProcessEntry[]} processes */
export function findStaleProcessTrees(processes) {
  const { parentOf, descendants } = indexProcesses(processes)
  return processes
    .filter((entry) => entry.pid > 4 && !parentOf(entry))
    .map((root) => ({ root, tree: [root, ...descendants(root)] }))
    .filter(
      ({ root, tree }) =>
        HEAVY.has(root.name) ||
        (LAUNCHERS.has(root.name) && tree.some((entry) => HEAVY.has(entry.name)))
    )
}

/**
 * Heavy workers the calling agent session started (its TypeScript server, a check still running),
 * so an automation can leave nothing behind when it ends. Its own ancestry is never selected.
 * @param {ProcessEntry[]} processes
 * @param {number} selfPid
 * @param {number} [parentPid]
 */
export function findSessionWorkerTrees(processes, selfPid, parentPid) {
  const { byPid, parentOf, descendants } = indexProcesses(processes)
  const ancestry = []
  // Why: a process started just before the snapshot can be missing from it.
  for (let entry = byPid.get(selfPid) ?? byPid.get(parentPid); entry; entry = parentOf(entry)) {
    ancestry.push(entry)
  }
  const session = ancestry.find((entry) => entry.name === SESSION)
  if (!session) {
    return []
  }
  return descendants(session)
    .filter((entry) => HEAVY.has(entry.name) && !HEAVY.has(parentOf(entry)?.name))
    .filter((root) => !ancestry.includes(root))
    .map((root) => ({ root, tree: [root, ...descendants(root)] }))
}

function readProcesses() {
  for (const set of COUNTER_SETS) {
    const counters = [set.pid, set.ppid, set.age].map((counter) => `\\${set.object}(*)\\${counter}`)
    const result = spawnSync('typeperf', ['-sc', '1', ...counters], { encoding: 'latin1' })
    const lines = (result.stdout ?? '').split(/\r?\n/).filter((line) => line.startsWith('"'))
    if (result.status !== 0 || lines.length < 2) {
      continue
    }
    const cells = (line) => line.slice(1, -1).split('","')
    // Why: typeperf writes in the console code page, so compare only the ASCII letters of names.
    const ascii = (text) => text.replace(/[^\x20-\x7e]/g, '')
    const fields = new Map([
      [ascii(set.pid), 'pid'],
      [ascii(set.ppid), 'ppid'],
      [ascii(set.age), 'ageSeconds']
    ])
    const values = cells(lines[1])
    const byInstance = new Map()
    cells(lines[0]).forEach((column, index) => {
      const match = /\\[^\\(]+\((.+)\)\\(.+)$/.exec(column)
      if (!match) {
        return
      }
      const entry = byInstance.get(match[1]) ?? { name: match[1].replace(/#\d+$/, '') }
      const field = fields.get(ascii(match[2]))
      if (field) {
        entry[field] = Number(values[index])
      }
      byInstance.set(match[1], entry)
    })
    return [...byInstance.values()].filter(
      (entry) =>
        entry.name !== '_Total' && Number.isFinite(entry.pid) && Number.isFinite(entry.ppid)
    )
  }
  throw new Error('typeperf returned no process counters')
}

function main(argv) {
  if (process.platform !== 'win32') {
    console.log('Only needed on Windows; nothing to do.')
    return
  }
  const kill = argv.includes('--kill')
  const session = argv.includes('--session')
  const processes = readProcesses()
  const found = session
    ? findSessionWorkerTrees(processes, process.pid, process.ppid)
    : findStaleProcessTrees(processes)
  if (found.length === 0) {
    console.log(session ? 'No session workers running.' : 'No stale check processes.')
    return
  }
  for (const { root, tree } of found) {
    const summary = tree.map((entry) => `${entry.name}:${entry.pid}`).join(', ')
    const minutes = Math.round(root.ageSeconds / 60)
    if (!kill) {
      const reason = session ? 'started by this session' : `parent ${root.ppid} gone`
      console.log(`${session ? 'session worker' : 'stale'} (${minutes} min, ${reason}): ${summary}`)
      continue
    }
    const result = spawnSync('taskkill', ['/PID', String(root.pid), '/T', '/F'], {
      encoding: 'latin1'
    })
    console.log(
      `${result.status === 0 ? 'stopped' : 'could not stop'} (${minutes} min): ${summary}`
    )
  }
}

// `-` is `git show fork/main:<this file> | node --input-type=module -` from a branch without it.
const entry = process.argv[1]
if (entry === '-' || (entry && import.meta.url === pathToFileURL(entry).href)) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
