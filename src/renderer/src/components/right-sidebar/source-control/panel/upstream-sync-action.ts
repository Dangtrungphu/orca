import type { GitUpstreamStatus } from '../../../../../../shared/git-status-types'
import { shouldForcePushWithLeaseForUpstream } from '../../../../../../shared/git-upstream-status'
import { translate } from '@/i18n/i18n'
import { describeForcePushWithLease } from '../../source-control-primary-action-titles'

export type UpstreamSyncActionKind = 'publish' | 'push' | 'force_push' | 'pull' | 'sync' | 'fetch'

/**
 * What VS Code's status-bar sync button would do for this branch: publish an unpublished branch,
 * otherwise reconcile ahead/behind, and fetch when there is nothing to reconcile so behind counts
 * catch up with the remote. Mirrors the clean-tree rung of the primary action, including its
 * lease-protected force push when the upstream only holds older copies of local commits.
 */
export function resolveUpstreamSyncAction(
  status: GitUpstreamStatus | undefined,
  hasBranch: boolean
): UpstreamSyncActionKind | null {
  if (!status || !hasBranch) {
    return null
  }
  if (!status.hasUpstream) {
    return 'publish'
  }
  if (shouldForcePushWithLeaseForUpstream(status)) {
    return 'force_push'
  }
  if (status.ahead > 0 && status.behind > 0) {
    return 'sync'
  }
  if (status.behind > 0) {
    return 'pull'
  }
  if (status.ahead > 0) {
    return 'push'
  }
  return 'fetch'
}

export function describeUpstreamSyncAction(
  kind: UpstreamSyncActionKind,
  status: GitUpstreamStatus
): string {
  const upstream = status.upstreamName ?? 'the remote branch'
  switch (kind) {
    case 'publish':
      return translate(
        'auto.components.right.sidebar.source.control.primary.action.1884cf34af',
        'Publish this branch to origin'
      )
    case 'force_push':
      return describeForcePushWithLease(status.ahead, status.upstreamName)
    case 'sync':
      return translate(
        'auto.components.right.sidebar.SourceControl.5d0c9e7a31',
        '{{value0}} to pull and {{value1}} to push with {{value2}}. Click to sync.',
        { value0: status.behind, value1: status.ahead, value2: upstream }
      )
    case 'pull':
      return translate(
        'auto.components.right.sidebar.SourceControl.a83f62c0d4',
        '{{value0}} incoming from {{value1}}. Click to pull.',
        { value0: status.behind, value1: upstream }
      )
    case 'push':
      return translate(
        'auto.components.right.sidebar.SourceControl.e1b47f9a26',
        '{{value0}} waiting to push to {{value1}}. Click to push.',
        { value0: status.ahead, value1: upstream }
      )
    case 'fetch':
      return translate(
        'auto.components.right.sidebar.SourceControl.7c25d8b0e9',
        'In sync with {{value0}}. Click to fetch and check for new commits.',
        { value0: upstream }
      )
  }
}
