// Runs this checkout's check:changed with Orca ITG's one-heavy-check-at-a-time pool.
// Why: upstream PR branches lack that pool, so even --maxWorkers=1 runs typecheck, tests and
// quality together and runs this Windows machine out of memory. Usable from any branch:
//   git show fork/main:config/scripts/itg-check-changed-sequential.mjs | node --input-type=module - --maxWorkers=1
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

// Why two layouts: upstream moved the script, so each location takes the pool from its own diff.
const LAYOUTS = [
  {
    script: 'config/scripts/preflight/changed-checks/check-changed.mjs',
    from: '7aca8a8e13d^2',
    to: '7aca8a8e13d'
  },
  { script: 'config/scripts/check-changed.mjs', from: '013c444ce8e^', to: '013c444ce8e' }
]
// Why node_modules: git ignores it and workspace packages resolve from it as from the original.
const COPY_DIR = 'node_modules/.itg'

/** Points relative imports of a relocated copy back at the original script's folder. */
export function rewriteSiblingImports(sourceText, scriptDirUrl) {
  return sourceText.replace(
    /(\bfrom\s+|\bimport\(\s*)(['"])(\.\.?\/[^'"]*)\2/g,
    (_, prefix, quote, specifier) =>
      `${prefix}${quote}${new URL(specifier, `${scriptDirUrl}/`).href}${quote}`
  )
}

function showAtHead(root, file) {
  const result = spawnSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout : null
}

function run() {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const layout = LAYOUTS.find(({ script }) => showAtHead(root, script) !== null)
  if (!layout) {
    console.error('itg-check-changed-sequential: no check-changed.mjs at HEAD.')
    return 1
  }
  const SCRIPT = layout.script
  const source = showAtHead(root, SCRIPT)
  let target = path.join(root, SCRIPT)
  if (!source.includes('heavyLimit')) {
    const copy = path.join(root, COPY_DIR, SCRIPT)
    fs.mkdirSync(path.dirname(copy), { recursive: true })
    fs.writeFileSync(copy, source)
    const patch = execFileSync('git', ['diff', layout.from, layout.to, '--', SCRIPT], {
      cwd: root
    })
    const applied = spawnSync('git', ['apply', `--directory=${COPY_DIR}`, '-'], {
      cwd: root,
      input: patch,
      stdio: ['pipe', 'inherit', 'inherit']
    })
    if (applied.status !== 0) {
      console.error(
        `itg-check-changed-sequential: ${layout.from}..${layout.to} no longer applies to ${SCRIPT}.`
      )
      return 1
    }
    const scriptDirUrl = pathToFileURL(path.join(root, path.dirname(SCRIPT))).href
    fs.writeFileSync(copy, rewriteSiblingImports(fs.readFileSync(copy, 'utf8'), scriptDirUrl))
    target = copy
  }
  const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
    cwd: root,
    stdio: 'inherit'
  })
  return result.status ?? 1
}

// Piped through `node --input-type=module -`, argv[1] is `-`.
const entry = process.argv[1]
if (entry === '-' || (entry && import.meta.url === pathToFileURL(entry).href)) {
  process.exitCode = run()
}
