// Runs this checkout's check:changed with Orca ITG's one-heavy-check-at-a-time pool.
// Why: upstream PR branches lack that pool, so even --maxWorkers=1 runs typecheck, tests and
// quality together and runs this Windows machine out of memory. Usable from any branch:
//   git show fork/main:config/scripts/itg-check-changed-sequential.mjs | node --input-type=module - --maxWorkers=1
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const SEQUENTIAL_COMMIT = '013c444ce8e'
const SCRIPT = 'config/scripts/check-changed.mjs'
// Why node_modules: git ignores it and workspace packages resolve from it as from the original.
const COPY_DIR = 'node_modules/.itg'

/** Points `./sibling.mjs` imports of a relocated copy back at the checkout's scripts folder. */
export function rewriteSiblingImports(sourceText, scriptsDirUrl) {
  return sourceText.replace(/(\bfrom\s+|\bimport\(\s*)(['"])\.\//g, `$1$2${scriptsDirUrl}/`)
}

function run() {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const source = execFileSync('git', ['show', `HEAD:${SCRIPT}`], { cwd: root, encoding: 'utf8' })
  let target = path.join(root, SCRIPT)
  if (!source.includes('heavyLimit')) {
    const copy = path.join(root, COPY_DIR, SCRIPT)
    fs.mkdirSync(path.dirname(copy), { recursive: true })
    fs.writeFileSync(copy, source)
    const patch = execFileSync('git', ['show', SEQUENTIAL_COMMIT, '--', SCRIPT], { cwd: root })
    const applied = spawnSync('git', ['apply', `--directory=${COPY_DIR}`, '-'], {
      cwd: root,
      input: patch,
      stdio: ['pipe', 'inherit', 'inherit']
    })
    if (applied.status !== 0) {
      console.error(
        `itg-check-changed-sequential: ${SEQUENTIAL_COMMIT} no longer applies to ${SCRIPT}.`
      )
      return 1
    }
    const scriptsDirUrl = pathToFileURL(path.join(root, 'config/scripts')).href
    fs.writeFileSync(copy, rewriteSiblingImports(fs.readFileSync(copy, 'utf8'), scriptsDirUrl))
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
