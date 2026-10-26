import { resolveLocalWorktreePath, type RuntimeGitContext } from './runtime-git-client-context'

/** Undoes HEAD (soft reset to its first parent) as long as HEAD is still `expectedHead`. */
export async function undoRuntimeGitLastCommit(
  context: RuntimeGitContext,
  expectedHead: string
): Promise<void> {
  // Why: there is no runtime RPC for this yet; local and WSL worktrees go through main directly.
  if (context.target.kind !== 'local' && context.worktreeId) {
    throw new Error('Undo commit is not available for remote runtimes yet.')
  }
  await window.api.git.undoLastCommit({
    worktreePath: resolveLocalWorktreePath(context),
    expectedHead,
    connectionId: context.connectionId
  })
}
