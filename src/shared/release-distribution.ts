// Forks publish their own releases; the updater, channel picker and release links follow the build's repository.

/** Substituted by electron.vite.config.ts; absent (upstream) in the CLI and the web client. */
declare const ORCA_RELEASE_REPOSITORY: string | undefined
/** Prerelease identifier of fork releases (`itg` in 1.4.242-itg.0); null for upstream builds. */
declare const ORCA_RELEASE_VERSION_TAG: string | null | undefined

export const UPSTREAM_RELEASE_REPOSITORY = 'stablyai/orca'

export const RELEASE_REPOSITORY =
  // oxlint-disable-next-line unicorn/no-typeof-undefined -- undeclared outside electron-vite builds; a bare read throws.
  typeof ORCA_RELEASE_REPOSITORY !== 'undefined'
    ? ORCA_RELEASE_REPOSITORY
    : UPSTREAM_RELEASE_REPOSITORY

export const IS_FORK_DISTRIBUTION = RELEASE_REPOSITORY !== UPSTREAM_RELEASE_REPOSITORY

const FORK_VERSION_TAG =
  // oxlint-disable-next-line unicorn/no-typeof-undefined -- undeclared outside electron-vite builds; a bare read throws.
  IS_FORK_DISTRIBUTION && typeof ORCA_RELEASE_VERSION_TAG !== 'undefined'
    ? ORCA_RELEASE_VERSION_TAG
    : null

/** True for `<x.y.z>-<versionTag>.<n>`: a fork's regular release, which the fork ships as stable. */
export function isForkReleaseVersion(
  version: string,
  versionTag: string | null = FORK_VERSION_TAG
): boolean {
  if (versionTag === null) {
    return false
  }
  const match = /^v?\d+\.\d+\.\d+-([a-z0-9]+)\.\d+$/i.exec(version.trim())
  return match !== null && match[1].toLowerCase() === versionTag
}
