import { describe, expect, it } from 'vitest'
import type { GitUpstreamStatus } from '../../../../../../shared/git-status-types'
import { describeUpstreamSyncAction, resolveUpstreamSyncAction } from './upstream-sync-action'

function upstream(overrides: Partial<GitUpstreamStatus> = {}): GitUpstreamStatus {
  return { hasUpstream: true, upstreamName: 'origin/develop', ahead: 0, behind: 0, ...overrides }
}

describe('resolveUpstreamSyncAction', () => {
  it('hides until the upstream status loads or when HEAD is not on a branch', () => {
    expect(resolveUpstreamSyncAction(undefined, true)).toBeNull()
    expect(resolveUpstreamSyncAction(upstream({ ahead: 1 }), false)).toBeNull()
  })

  it('publishes a branch without an upstream', () => {
    expect(resolveUpstreamSyncAction({ hasUpstream: false, ahead: 0, behind: 0 }, true)).toBe(
      'publish'
    )
  })

  it('picks push, pull or sync from the ahead/behind counts', () => {
    expect(resolveUpstreamSyncAction(upstream({ ahead: 2 }), true)).toBe('push')
    expect(resolveUpstreamSyncAction(upstream({ behind: 3 }), true)).toBe('pull')
    expect(resolveUpstreamSyncAction(upstream({ ahead: 1, behind: 1 }), true)).toBe('sync')
  })

  it('force pushes with lease when the upstream only holds older copies of local commits', () => {
    expect(
      resolveUpstreamSyncAction(
        upstream({ ahead: 2, behind: 2, behindCommitsArePatchEquivalent: true }),
        true
      )
    ).toBe('force_push')
  })

  it('fetches when already in sync so behind counts can catch up', () => {
    expect(resolveUpstreamSyncAction(upstream(), true)).toBe('fetch')
  })
})

describe('describeUpstreamSyncAction', () => {
  it('names the counts and the upstream branch', () => {
    expect(describeUpstreamSyncAction('push', upstream({ ahead: 1 }))).toBe(
      '1 waiting to push to origin/develop. Click to push.'
    )
    expect(describeUpstreamSyncAction('sync', upstream({ ahead: 1, behind: 2 }))).toBe(
      '2 to pull and 1 to push with origin/develop. Click to sync.'
    )
  })
})
