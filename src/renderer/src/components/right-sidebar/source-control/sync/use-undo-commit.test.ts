import { describe, expect, it } from 'vitest'
import type { GitHistoryResult } from '../../../../../../shared/git-history'
import { isHistoryHeadPushed } from './use-undo-commit'

function history(overrides: Partial<GitHistoryResult>): GitHistoryResult {
  return {
    items: [],
    hasIncomingChanges: false,
    hasOutgoingChanges: false,
    hasMore: false,
    limit: 50,
    currentRef: { id: 'refs/heads/develop', name: 'develop', revision: 'a'.repeat(40) },
    ...overrides
  }
}

describe('isHistoryHeadPushed', () => {
  it('treats a branch without an upstream as unpushed', () => {
    expect(isHistoryHeadPushed(history({ remoteRef: undefined }))).toBe(false)
  })

  it('treats HEAD equal to its upstream as pushed', () => {
    const remoteRef = {
      id: 'refs/remotes/origin/develop',
      name: 'origin/develop',
      revision: 'a'.repeat(40)
    }
    expect(isHistoryHeadPushed(history({ remoteRef, hasOutgoingChanges: true }))).toBe(true)
  })

  it('treats HEAD with outgoing commits as unpushed', () => {
    const remoteRef = {
      id: 'refs/remotes/origin/develop',
      name: 'origin/develop',
      revision: 'b'.repeat(40)
    }
    expect(isHistoryHeadPushed(history({ remoteRef, hasOutgoingChanges: true }))).toBe(false)
  })

  it('treats HEAD behind its upstream as pushed', () => {
    const remoteRef = {
      id: 'refs/remotes/origin/develop',
      name: 'origin/develop',
      revision: 'b'.repeat(40)
    }
    expect(
      isHistoryHeadPushed(
        history({ remoteRef, hasIncomingChanges: true, hasOutgoingChanges: false })
      )
    ).toBe(true)
  })

  it('handles a missing history result', () => {
    expect(isHistoryHeadPushed(undefined)).toBe(false)
  })
})
