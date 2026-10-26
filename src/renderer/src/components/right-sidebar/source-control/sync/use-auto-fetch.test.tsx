// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchRuntimeGit: vi.fn(),
  storeState: { isRemoteOperationActive: false }
}))

vi.mock('@/runtime/runtime-git-sync-client', () => ({ fetchRuntimeGit: mocks.fetchRuntimeGit }))
vi.mock('@/lib/connection-context', () => ({ getConnectionId: () => null }))
vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.storeState } }))

import {
  AUTO_FETCH_INTERVAL_MS,
  resetAutoFetchClockForTests,
  useSourceControlAutoFetch
} from './use-auto-fetch'

const LOCAL_TARGET = { kind: 'local' } as const

function renderAutoFetch(overrides: { hasUpstream?: boolean; isBranchVisible?: boolean } = {}) {
  const fetchUpstreamStatus = vi.fn().mockResolvedValue(null)
  const hook = renderHook(() =>
    useSourceControlAutoFetch({
      activeRepoTarget: LOCAL_TARGET,
      activeWorktree: null,
      activeWorktreeId: 'wt-1',
      fetchUpstreamStatus,
      hasUpstream: overrides.hasUpstream ?? true,
      isBranchVisible: overrides.isBranchVisible ?? true,
      isFolder: false,
      worktreePath: '/repo'
    } as unknown as Parameters<typeof useSourceControlAutoFetch>[0])
  )
  return { ...hook, fetchUpstreamStatus }
}

describe('useSourceControlAutoFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetAutoFetchClockForTests()
    mocks.fetchRuntimeGit.mockReset().mockResolvedValue(undefined)
    mocks.storeState.isRemoteOperationActive = false
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches on open, recounts ahead/behind, then again every interval', async () => {
    const { fetchUpstreamStatus, unmount } = renderAutoFetch()
    await act(async () => {})
    expect(mocks.fetchRuntimeGit).toHaveBeenCalledTimes(1)
    expect(mocks.fetchRuntimeGit).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: 'wt-1', worktreePath: '/repo' }),
      undefined
    )
    expect(fetchUpstreamStatus).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_FETCH_INTERVAL_MS)
    })
    expect(mocks.fetchRuntimeGit).toHaveBeenCalledTimes(2)
    unmount()
  })

  it('does not refetch when the panel remounts within the interval', async () => {
    const first = renderAutoFetch()
    await act(async () => {})
    first.unmount()
    const second = renderAutoFetch()
    await act(async () => {})
    expect(mocks.fetchRuntimeGit).toHaveBeenCalledTimes(1)
    second.unmount()
  })

  it('recounts from local refs on window focus, without waiting for the next fetch', async () => {
    const { fetchUpstreamStatus, unmount } = renderAutoFetch()
    await act(async () => {})
    fetchUpstreamStatus.mockClear()
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(fetchUpstreamStatus).toHaveBeenCalledTimes(1)
    expect(mocks.fetchRuntimeGit).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('stays quiet when fetch fails, and yields to a user-started remote operation', async () => {
    mocks.fetchRuntimeGit.mockRejectedValueOnce(new Error('offline'))
    const { fetchUpstreamStatus, unmount } = renderAutoFetch()
    await act(async () => {})
    expect(fetchUpstreamStatus).not.toHaveBeenCalled()

    mocks.storeState.isRemoteOperationActive = true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_FETCH_INTERVAL_MS)
    })
    expect(mocks.fetchRuntimeGit).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('does nothing without an upstream or while Source Control is hidden', async () => {
    renderAutoFetch({ hasUpstream: false }).unmount()
    renderAutoFetch({ isBranchVisible: false }).unmount()
    await act(async () => {})
    expect(mocks.fetchRuntimeGit).not.toHaveBeenCalled()
  })
})
