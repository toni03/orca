#!/usr/bin/env node
// Lists, or with --kill stops, check process trees whose launching shell is gone. Windows does not
// stop children with their parent, so a check:changed whose agent shell ended keeps its bun,
// tsgolint and tsc workers (several GB each) running with nobody reading the result.
// Usage: node config/scripts/itg-stale-check-processes.mjs [--kill]
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const HEAVY = new Set(['bun', 'tsgolint', 'tsc'])
const LAUNCHERS = new Set(['sh', 'bash', 'cmd', 'pnpm', 'node'])

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

/** @param {{ name: string, pid: number, ppid: number, ageSeconds: number }[]} processes */
export function findStaleProcessTrees(processes) {
  const byPid = new Map(processes.map((entry) => [entry.pid, entry]))
  const children = new Map()
  for (const entry of processes) {
    children.set(entry.ppid, [...(children.get(entry.ppid) ?? []), entry])
  }
  const descendants = (root) => {
    const out = []
    const queue = [...(children.get(root.pid) ?? [])]
    while (queue.length > 0) {
      const entry = queue.shift()
      // A younger process cannot be the parent of an older one: that PID was reused.
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
  return processes
    .filter((entry) => {
      const parent = byPid.get(entry.ppid)
      return entry.pid > 4 && (!parent || parent.ageSeconds < entry.ageSeconds)
    })
    .map((root) => ({ root, tree: [root, ...descendants(root)] }))
    .filter(
      ({ root, tree }) =>
        HEAVY.has(root.name) ||
        (LAUNCHERS.has(root.name) && tree.some((entry) => HEAVY.has(entry.name)))
    )
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
  const stale = findStaleProcessTrees(readProcesses())
  if (stale.length === 0) {
    console.log('No stale check processes.')
    return
  }
  for (const { root, tree } of stale) {
    const summary = tree.map((entry) => `${entry.name}:${entry.pid}`).join(', ')
    const minutes = Math.round(root.ageSeconds / 60)
    if (!kill) {
      console.log(`stale (${minutes} min, parent ${root.ppid} gone): ${summary}`)
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
