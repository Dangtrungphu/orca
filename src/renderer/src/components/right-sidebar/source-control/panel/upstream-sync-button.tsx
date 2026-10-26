import React from 'react'
import { CloudUpload, Loader2, RefreshCw } from 'lucide-react'
import type { GitUpstreamStatus } from '../../../../../../shared/git-status-types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  describeUpstreamSyncAction,
  resolveUpstreamSyncAction,
  type UpstreamSyncActionKind
} from './upstream-sync-action'

/**
 * VS Code's status-bar sync control for the visible branch: incoming/outgoing counts that are always
 * on screen (the primary button only turns into Push/Sync once the tree is clean) and one click to
 * publish, pull, push, sync or fetch through the panel's shared action dispatcher.
 */
export function SourceControlUpstreamSyncButton({
  remoteStatus,
  hasBranch,
  busy,
  onAction
}: {
  remoteStatus: GitUpstreamStatus | undefined
  hasBranch: boolean
  busy: boolean
  onAction: (kind: UpstreamSyncActionKind) => void
}): React.JSX.Element | null {
  const kind = resolveUpstreamSyncAction(remoteStatus, hasBranch)
  if (!kind || !remoteStatus) {
    return null
  }
  const title = busy
    ? translate(
        'auto.components.right.sidebar.source.control.primary.action.6f7a8b9c0d',
        'Remote operation in progress…'
      )
    : describeUpstreamSyncAction(kind, remoteStatus)
  const Icon = kind === 'publish' ? (busy ? Loader2 : CloudUpload) : RefreshCw
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid="source-control-upstream-sync"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm px-1.5 text-[11px] tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
          aria-label={title}
          disabled={busy}
          onClick={() => onAction(kind)}
        >
          <Icon className={cn('size-3.5 shrink-0', busy && 'animate-spin')} aria-hidden="true" />
          {kind === 'publish' ? null : (
            <>
              <span className={cn(remoteStatus.behind > 0 && 'font-medium text-foreground')}>
                {remoteStatus.behind}↓
              </span>
              <span className={cn(remoteStatus.ahead > 0 && 'font-medium text-foreground')}>
                {remoteStatus.ahead}↑
              </span>
            </>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="max-w-72">
        {title}
      </TooltipContent>
    </Tooltip>
  )
}
