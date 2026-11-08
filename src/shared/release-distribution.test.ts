import { describe, expect, it } from 'vitest'
import {
  IS_FORK_DISTRIBUTION,
  isForkBetaVersion,
  isForkReleaseVersion
} from './release-distribution'

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

describe('isForkBetaVersion', () => {
  it('matches only <x.y.z>-<versionTag>.<n>.beta.<k> for the configured tag', () => {
    expect(isForkBetaVersion('1.4.253-itg.0.beta.1', 'itg')).toBe(true)
    expect(isForkBetaVersion('v1.4.253-itg.2.beta.10', 'itg')).toBe(true)
    expect(isForkBetaVersion('1.4.253-itg.0', 'itg')).toBe(false)
    expect(isForkBetaVersion('1.4.253-rc.0.beta.1', 'itg')).toBe(false)
    expect(isForkBetaVersion('1.4.253-itg.0.beta', 'itg')).toBe(false)
  })

  it('never matches in upstream builds', () => {
    expect(isForkBetaVersion('1.4.253-itg.0.beta.1')).toBe(false)
  })
})
