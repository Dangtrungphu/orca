import { useCallback } from 'react'
import { toast } from 'sonner'
import { requireGitOwnerTarget } from '../../worktree-git-owner-target'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'
import { getConnectionId } from '@/lib/connection-context'
import { undoRuntimeGitLastCommit } from '@/runtime/runtime-git-undo-commit-client'
import type { GitHistoryItem, GitHistoryResult } from '../../../../../../shared/git-history'
import type { SourceControlWorktreeContext } from '../listing/use-worktree-context'
import { refreshSourceControlAfterRemoteAction } from './remote-refresh'
import type { SourceControlStatusRefresh } from './use-status-refresh'

/** Whether HEAD is already on its upstream, so undoing it rewrites shared history. */
export function isHistoryHeadPushed(result: GitHistoryResult | undefined): boolean {
  if (!result?.remoteRef?.revision || !result.currentRef?.revision) {
    return false
  }
  return result.remoteRef.revision === result.currentRef.revision || !result.hasOutgoingChanges
}

/**
 * VS Code's "Undo Commit": HEAD moves to its parent and the commit's changes stay staged. Only the
 * HEAD row offers it; a pushed commit asks first because the next push then needs force-with-lease.
 */
export function useSourceControlUndoCommit({
  activeRepoTarget,
  activeWorktreeId,
  refreshActiveGitStatusAfterMutation,
  refreshBranchCompareRef,
  refreshGitHistoryRef,
  worktreePath
}: {
  activeRepoTarget: SourceControlWorktreeContext['activeRepoTarget']
  activeWorktreeId: string | null
  refreshActiveGitStatusAfterMutation: SourceControlStatusRefresh['refreshActiveGitStatusAfterMutation']
  refreshBranchCompareRef: React.RefObject<() => Promise<void>>
  refreshGitHistoryRef: React.RefObject<() => Promise<void>>
  worktreePath: string | null
}) {
  const confirmAction = useConfirmationDialog()

  const handleUndoCommit = useCallback(
    async (item: GitHistoryItem, history: GitHistoryResult | undefined): Promise<void> => {
      if (!activeWorktreeId || !worktreePath || history?.currentRef?.revision !== item.id) {
        return
      }
      if (isHistoryHeadPushed(history)) {
        const confirmed = await confirmAction({
          title: translate(
            'auto.components.right.sidebar.SourceControl.c6a604d42c',
            'Undo a pushed commit?'
          ),
          description: translate(
            'auto.components.right.sidebar.SourceControl.cf108e6aca',
            'This commit is already on {{value0}}. Undoing it rewrites the branch history, so the next push needs force-with-lease. Its changes stay staged.',
            { value0: history.remoteRef?.name ?? 'the remote' }
          ),
          confirmLabel: translate(
            'auto.components.right.sidebar.SourceControl.81caf07dae',
            'Undo Commit'
          ),
          confirmVariant: 'destructive'
        })
        if (!confirmed) {
          return
        }
      }

      try {
        await undoRuntimeGitLastCommit(
          {
            // Why: route by the repo OWNER host, not the focused runtime.
            target: requireGitOwnerTarget(activeRepoTarget),
            worktreeId: activeWorktreeId,
            worktreePath,
            connectionId: getConnectionId(activeWorktreeId) ?? undefined
          },
          item.id
        )
        toast.success(
          translate('auto.components.right.sidebar.SourceControl.2205b03ff0', 'Commit undone'),
          {
            description: translate(
              'auto.components.right.sidebar.SourceControl.cbcb2ed57e',
              'Its changes are staged.'
            )
          }
        )
      } catch (error) {
        toast.error(
          translate('auto.components.right.sidebar.SourceControl.2d4ee01e3f', 'Undo commit failed'),
          { description: error instanceof Error ? error.message : String(error) }
        )
      } finally {
        refreshSourceControlAfterRemoteAction({
          refreshGitStatus: refreshActiveGitStatusAfterMutation,
          refreshBranchCompare: refreshBranchCompareRef.current,
          refreshGitHistory: refreshGitHistoryRef.current
        })
      }
    },
    [
      activeRepoTarget,
      activeWorktreeId,
      confirmAction,
      refreshActiveGitStatusAfterMutation,
      refreshBranchCompareRef,
      refreshGitHistoryRef,
      worktreePath
    ]
  )

  return { handleUndoCommit }
}
