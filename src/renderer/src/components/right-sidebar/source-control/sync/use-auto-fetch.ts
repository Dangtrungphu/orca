import { useEffect } from 'react'
import { getConnectionId } from '@/lib/connection-context'
import { isWindowVisible } from '@/lib/window-visibility-interval'
import { fetchRuntimeGit } from '@/runtime/runtime-git-sync-client'
import { useAppStore } from '@/store'
import { requireGitOwnerTarget } from '../../worktree-git-owner-target'
import type { SourceControlStoreActions } from '../listing/use-store-actions'
import type { SourceControlWorktreeContext } from '../listing/use-worktree-context'

/** VS Code's `git.autofetch` default period. */
export const AUTO_FETCH_INTERVAL_MS = 180_000

// Why module-level: switching worktrees or remounting the panel must not refetch a remote that was
// fetched moments ago.
const lastAutoFetchAtByWorktree = new Map<string, number>()

export function resetAutoFetchClockForTests(): void {
  lastAutoFetchAtByWorktree.clear()
}

/**
 * VS Code's autofetch for the visible branch, so the incoming count in the sync button moves without
 * a manual Fetch: a silent `git fetch` every few minutes while Source Control is on screen, plus a
 * local ahead/behind recount whenever the window regains focus, because another tool (VS Code's own
 * autofetch, a terminal `git fetch`) may have moved the remote ref while Orca was in the background.
 */
export function useSourceControlAutoFetch({
  activeRepoTarget,
  activeWorktree,
  activeWorktreeId,
  fetchUpstreamStatus,
  hasUpstream,
  isBranchVisible,
  isFolder,
  worktreePath
}: {
  activeRepoTarget: SourceControlWorktreeContext['activeRepoTarget']
  activeWorktree: SourceControlWorktreeContext['activeWorktree']
  activeWorktreeId: string | null
  fetchUpstreamStatus: SourceControlStoreActions['fetchUpstreamStatus']
  hasUpstream: boolean
  isBranchVisible: boolean
  isFolder: boolean
  worktreePath: string | null
}): void {
  useEffect(() => {
    if (!activeWorktreeId || !worktreePath || isFolder || !isBranchVisible || !hasUpstream) {
      return
    }
    const worktreeId = activeWorktreeId
    const path = worktreePath
    const connectionId = getConnectionId(worktreeId) ?? undefined
    const pushTarget = activeWorktree?.pushTarget
    let disposed = false
    let inFlight = false

    const recount = (): void => {
      void fetchUpstreamStatus(worktreeId, path, connectionId, pushTarget, {
        runtimeTarget: activeRepoTarget
      })
    }
    const autoFetch = async (): Promise<void> => {
      const lastFetchAt = lastAutoFetchAtByWorktree.get(worktreeId) ?? 0
      if (
        disposed ||
        inFlight ||
        !isWindowVisible() ||
        Date.now() - lastFetchAt < AUTO_FETCH_INTERVAL_MS ||
        // Why: a user-started push/pull/fetch owns the remote; a silent fetch would race it.
        useAppStore.getState().isRemoteOperationActive
      ) {
        return
      }
      inFlight = true
      lastAutoFetchAtByWorktree.set(worktreeId, Date.now())
      try {
        await fetchRuntimeGit(
          {
            // Why: route by the repo OWNER host, not the focused runtime.
            target: requireGitOwnerTarget(activeRepoTarget),
            worktreeId,
            worktreePath: path,
            connectionId
          },
          pushTarget
        )
        if (!disposed) {
          recount()
        }
      } catch {
        // Why: offline, expired credentials or a missing remote are not worth a toast on a timer;
        // the manual Fetch still reports them.
      } finally {
        inFlight = false
      }
    }
    const handleFocus = (): void => {
      recount()
      void autoFetch()
    }

    void autoFetch()
    const timer = window.setInterval(() => void autoFetch(), AUTO_FETCH_INTERVAL_MS)
    window.addEventListener('focus', handleFocus)
    return () => {
      disposed = true
      window.clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
    }
  }, [
    activeRepoTarget,
    activeWorktree?.pushTarget,
    activeWorktreeId,
    fetchUpstreamStatus,
    hasUpstream,
    isBranchVisible,
    isFolder,
    worktreePath
  ])
}
