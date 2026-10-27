// Forks ship their own builds by setting ORCA_RELEASE_REPOSITORY (owner/repo) and, optionally, a display name.
const UPSTREAM_RELEASE_REPOSITORY = 'stablyai/orca'

function resolveReleaseDistribution(env = process.env) {
  const repository = env.ORCA_RELEASE_REPOSITORY?.trim() || UPSTREAM_RELEASE_REPOSITORY
  const match = /^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/.exec(repository)
  if (!match) {
    throw new Error(`ORCA_RELEASE_REPOSITORY must be "owner/repo", got "${repository}"`)
  }
  const displayName = env.ORCA_RELEASE_DISPLAY_NAME?.trim() || null
  return {
    repository,
    owner: match[1],
    repo: match[2],
    isUpstream: repository === UPSTREAM_RELEASE_REPOSITORY,
    displayName,
    artifactPrefix: displayName
      ? displayName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      : 'orca'
  }
}

module.exports = { UPSTREAM_RELEASE_REPOSITORY, resolveReleaseDistribution }
