// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import { useSourceControlActionModel } from './use-action-model'

const UNSTAGED: GitStatusEntry = { path: 'src/app.ts', status: 'modified', area: 'unstaged' }
const UNTRACKED: GitStatusEntry = { path: 'notes.md', status: 'untracked', area: 'untracked' }
const STAGED: GitStatusEntry = { path: 'src/lib.ts', status: 'modified', area: 'staged' }

function renderActionModel({
  staged = [],
  unstaged = [UNSTAGED],
  untracked = [UNTRACKED],
  commitMessage = 'fix: things',
  unresolvedConflictCount = 0
}: {
  staged?: GitStatusEntry[]
  unstaged?: GitStatusEntry[]
  untracked?: GitStatusEntry[]
  commitMessage?: string
  unresolvedConflictCount?: number
}) {
  const upstream = { hasUpstream: true, upstreamName: 'origin/feature', ahead: 0, behind: 0 }
  return renderHook(() =>
    useSourceControlActionModel({
      grouped: { staged, unstaged, untracked },
      commitMessage,
      unresolvedConflictCount,
      isCommitting: false,
      isRemoteOperationActive: false,
      isAbortingOperation: false,
      remoteStatusForActions: upstream,
      hostedReviewStateForActions: null,
      isHostedReviewStateLoading: false,
      inFlightRemoteOpKind: null,
      hostedReviewCreation: null,
      branchSummary: null,
      branchName: 'feature',
      canUseHostedReviewPushTarget: false,
      isCreatePrIntentInFlight: false,
      remoteStatus: upstream,
      hostedReviewState: null,
      hostedReviewCreationForHeader: null,
      isHostedReviewCreationLoading: false,
      prGenerating: false,
      isCreatingPr: false,
      hostedReviewReviewLabel: 'pull request',
      hasSuppressedGitHubPRState: false,
      conflictOperation: 'unknown',
      effectiveBaseRef: null
    })
  ).result.current
}

function dropdownItem(model: ReturnType<typeof renderActionModel>, kind: string) {
  return model.dropdownItems.find((entry) => entry.kind === kind) as
    | { disabled?: boolean }
    | undefined
}

describe('useSourceControlActionModel smart commit', () => {
  it('offers Commit instead of Stage All when nothing is staged, like VS Code', () => {
    const model = renderActionModel({})
    expect(model.commitsAllChanges).toBe(true)
    expect(model.primaryAction).toMatchObject({ kind: 'commit', disabled: false })
    expect(model.primaryAction.title).toBe('Stage all changes and commit')
    expect(dropdownItem(model, 'commit')?.disabled).toBe(false)
    expect(dropdownItem(model, 'commit_push')?.disabled).toBe(false)
  })

  it('waits for a message before committing everything', () => {
    const model = renderActionModel({ commitMessage: '  ' })
    expect(model.primaryAction).toMatchObject({ kind: 'commit', disabled: true })
  })

  it('keeps committing only the staged set once something is staged', () => {
    const model = renderActionModel({ staged: [STAGED] })
    expect(model.commitsAllChanges).toBe(false)
    expect(model.primaryAction).toMatchObject({ kind: 'commit', disabled: false })
    expect(model.primaryAction.title).toBe('Commit staged changes')
  })

  it('stays off while conflicts are unresolved or when there is nothing to stage', () => {
    expect(renderActionModel({ unresolvedConflictCount: 1 }).commitsAllChanges).toBe(false)
    expect(renderActionModel({ unstaged: [], untracked: [] }).commitsAllChanges).toBe(false)
  })
})
