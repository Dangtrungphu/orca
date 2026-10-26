// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSourceControlActionDispatch } from './use-action-dispatch'

function renderDispatch({
  stageAllBeforeCommit,
  stageResult = true
}: {
  stageAllBeforeCommit: boolean
  stageResult?: boolean
}) {
  const calls: string[] = []
  const handleStageAllPrimary = vi.fn(async () => {
    calls.push('stage')
    return stageResult
  })
  const handleCommit = vi.fn(async () => {
    calls.push('commit')
    return true
  })
  const runCompoundCommitAction = vi.fn(async () => {
    calls.push('commit+remote')
  })
  const { result } = renderHook(() =>
    useSourceControlActionDispatch({
      createPrHeaderAction: null,
      handleAbortMerge: vi.fn(),
      handleAbortRebase: vi.fn(),
      handleCommit,
      handleCreatePullRequest: vi.fn(),
      handleStageAllPrimary,
      isCreatePrIntentInFlight: false,
      isCreatingPr: false,
      primaryAction: { kind: 'commit', label: 'Commit', title: '', disabled: false },
      prGenerating: false,
      remoteStatus: undefined,
      remoteStatusForActions: undefined,
      runCompoundCommitAction,
      runCreatePrIntent: vi.fn(),
      runRemoteAction: vi.fn(),
      stageAllBeforeCommit
    } as unknown as Parameters<typeof useSourceControlActionDispatch>[0])
  )
  return { result, calls, handleCommit, handleStageAllPrimary, runCompoundCommitAction }
}

describe('useSourceControlActionDispatch smart commit', () => {
  it('stages every change, then commits past the stale staged-count snapshot', async () => {
    const { result, calls, handleCommit } = renderDispatch({ stageAllBeforeCommit: true })
    await act(async () => {
      result.current.handlePrimaryClick()
    })
    expect(calls).toEqual(['stage', 'commit'])
    expect(handleCommit).toHaveBeenCalledWith(undefined, { skipStagedSnapshotCheck: true })
  })

  it('stages first for Commit & Push too', async () => {
    const { result, calls, runCompoundCommitAction } = renderDispatch({
      stageAllBeforeCommit: true
    })
    await act(async () => {
      result.current.handleActionInvoke('commit_push')
    })
    expect(calls).toEqual(['stage', 'commit+remote'])
    expect(runCompoundCommitAction).toHaveBeenCalledWith('push', {
      skipStagedSnapshotCheck: true
    })
  })

  it('does not commit when staging failed', async () => {
    const { result, calls } = renderDispatch({ stageAllBeforeCommit: true, stageResult: false })
    await act(async () => {
      result.current.handlePrimaryClick()
    })
    expect(calls).toEqual(['stage'])
  })

  it('commits the staged set directly when something is already staged', async () => {
    const { result, calls, handleStageAllPrimary } = renderDispatch({
      stageAllBeforeCommit: false
    })
    await act(async () => {
      result.current.handlePrimaryClick()
    })
    expect(handleStageAllPrimary).not.toHaveBeenCalled()
    expect(calls).toEqual(['commit'])
  })
})
