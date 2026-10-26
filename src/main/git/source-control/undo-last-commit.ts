import type { GitRuntimeOptions } from '../git-runtime-options'
import { gitOptionsForWorktree } from '../git-runtime-options'
import { gitExecFileAsync } from '../runner'
import { runWithGitReadCacheInvalidation } from './git-read-cache-invalidation'

const COMMIT_OID = /^[0-9a-f]{40}([0-9a-f]{24})?$/

export function isCommitOid(value: unknown): value is string {
  return typeof value === 'string' && COMMIT_OID.test(value)
}

/**
 * Undoes the last commit like VS Code's "Undo Commit" (`git reset --soft HEAD~1`): the branch moves
 * to the commit's first parent while the index and working tree keep its changes, staged. A root
 * commit has no parent, so its branch ref is deleted instead.
 *
 * Why update-ref with the old value: it is a compare-and-swap, so if HEAD moved after the history
 * row rendered (another commit landed), git refuses rather than undoing a commit nobody picked.
 */
export async function undoLastCommit(
  worktreePath: string,
  expectedHead: string,
  options: GitRuntimeOptions = {}
): Promise<void> {
  if (!isCommitOid(expectedHead)) {
    throw new Error('Undo commit needs the full id of the commit to undo')
  }
  const execOptions = gitOptionsForWorktree(worktreePath, options)
  await runWithGitReadCacheInvalidation(async () => {
    const { stdout } = await gitExecFileAsync(
      ['rev-list', '--parents', '-n', '1', expectedHead],
      execOptions
    )
    const [, firstParent] = stdout.trim().split(/\s+/)
    const message = `undo commit: moving to ${firstParent ?? 'unborn branch'}`
    try {
      await gitExecFileAsync(
        firstParent
          ? ['update-ref', '-m', message, 'HEAD', firstParent, expectedHead]
          : ['update-ref', '-m', message, '-d', 'HEAD', expectedHead],
        execOptions
      )
    } catch (error) {
      if (await headIsNot(expectedHead, execOptions)) {
        throw new Error('The branch moved since the history was loaded. Refresh and try again.')
      }
      throw error
    }
  })
}

async function headIsNot(
  expectedHead: string,
  execOptions: ReturnType<typeof gitOptionsForWorktree>
): Promise<boolean> {
  try {
    const { stdout } = await gitExecFileAsync(['rev-parse', 'HEAD'], execOptions)
    return stdout.trim() !== expectedHead
  } catch {
    return true
  }
}
