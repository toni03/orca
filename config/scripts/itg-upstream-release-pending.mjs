#!/usr/bin/env node
// Exits 0 when upstream has a stable release newer than the base of the fork's latest ITG release.
// Precheck of the daily upstream sync automation: any other exit code skips the run.
// Usage: node config/scripts/itg-upstream-release-pending.mjs <fork owner/repo>

const UPSTREAM = 'stablyai/orca'
const fork = process.argv[2]
if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(fork ?? '')) {
  console.error('Usage: itg-upstream-release-pending.mjs <fork owner/repo>')
  process.exit(2)
}

async function latestReleaseTag(repository) {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'orca-itg-upstream-check' },
    signal: AbortSignal.timeout(15_000)
  })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`${repository}: GitHub answered ${response.status}`)
  }
  const { tag_name: tag } = await response.json()
  return typeof tag === 'string' ? tag : null
}

function baseVersion(tag) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-|$)/.exec(tag ?? '')
  return match ? match.slice(1, 4).map(Number) : null
}

function isNewer(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] > right[index]
    }
  }
  return false
}

try {
  const [upstreamTag, forkTag] = await Promise.all([
    latestReleaseTag(UPSTREAM),
    latestReleaseTag(fork)
  ])
  const upstream = baseVersion(upstreamTag)
  if (!upstream) {
    console.error(`No stable release found in ${UPSTREAM}.`)
    process.exit(2)
  }
  const forkBase = baseVersion(forkTag)
  if (forkBase && !isNewer(upstream, forkBase)) {
    console.log(`Up to date: ${fork} ${forkTag} is based on ${UPSTREAM} ${upstreamTag}.`)
    process.exit(1)
  }
  console.log(
    `New upstream release: ${UPSTREAM} ${upstreamTag} (latest in ${fork}: ${forkTag ?? 'none'}).`
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(2)
}
