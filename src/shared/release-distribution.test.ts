import { describe, expect, it } from 'vitest'
import { IS_FORK_DISTRIBUTION, isForkReleaseVersion } from './release-distribution'

describe('isForkReleaseVersion', () => {
  it('matches only <x.y.z>-<versionTag>.<n> for the configured tag', () => {
    expect(isForkReleaseVersion('1.4.242-itg.0', 'itg')).toBe(true)
    expect(isForkReleaseVersion('v1.4.242-itg.12', 'itg')).toBe(true)
    expect(isForkReleaseVersion('1.4.242-rc.1', 'itg')).toBe(false)
    expect(isForkReleaseVersion('1.4.242-itg.0.1', 'itg')).toBe(false)
    expect(isForkReleaseVersion('1.4.242-itgx.0', 'itg')).toBe(false)
    expect(isForkReleaseVersion('1.4.242', 'itg')).toBe(false)
  })

  it('never matches in upstream builds, so upstream prereleases keep their channels', () => {
    expect(IS_FORK_DISTRIBUTION).toBe(false)
    expect(isForkReleaseVersion('1.4.242-itg.0')).toBe(false)
  })
})
