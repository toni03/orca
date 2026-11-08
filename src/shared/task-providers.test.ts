import { describe, expect, it } from 'vitest'
import { filterAvailableTaskProviders } from './task-providers'

describe('task providers', () => {
  it('hides settled disconnected providers and keeps still-checking ones on the legacy rule', () => {
    const availability = {
      gitlabInstalled: true,
      linearConnected: false,
      connected: { github: false, gitlab: true, jira: false }
    }

    expect(filterAvailableTaskProviders(['github', 'gitlab', 'jira'], availability)).toEqual([
      'gitlab'
    ])
    expect(
      filterAvailableTaskProviders(['github', 'gitlab', 'jira'], {
        ...availability,
        connected: { gitlab: true }
      })
    ).toEqual(['github', 'gitlab', 'jira'])
  })
})
