import type React from 'react'
import { Copy, Globe, Hash, Sparkles, Undo2 } from 'lucide-react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import type { GitHistoryItem } from '../../../../../../shared/git-history'
import { useAppStore } from '@/store'
import { getClientCreationActionPolicy } from '@/lib/client-creation-action-policy'

export type GitHistoryCommitAction =
  | 'undo-commit'
  | 'open-remote'
  | 'copy-hash'
  | 'copy-message'
  | 'explain'

export function GitHistoryCommitContextMenu({
  item,
  canUndo = false,
  onAction
}: {
  item: GitHistoryItem
  /** Only the HEAD commit can be undone, matching VS Code. */
  canUndo?: boolean
  onAction: (action: GitHistoryCommitAction, item: GitHistoryItem) => void
}): React.JSX.Element {
  const managedBrowserCreationEnabled = useAppStore(
    (state) =>
      getClientCreationActionPolicy(state, state.activeWorktreeId)['managed-browser'].state ===
      'enabled'
  )
  return (
    <ContextMenuContent className="w-56">
      {canUndo ? (
        <>
          <ContextMenuItem onSelect={() => onAction('undo-commit', item)}>
            <Undo2 className="size-3.5" />
            {translate(
              'auto.components.right.sidebar.GitHistoryCommitContextMenu.6538d8536d',
              'Undo Commit'
            )}
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      ) : null}
      {managedBrowserCreationEnabled ? (
        <ContextMenuItem onSelect={() => onAction('open-remote', item)}>
          <Globe className="size-3.5" />
          {translate(
            'auto.components.right.sidebar.GitHistoryCommitContextMenu.7b1c4e9a02',
            'Open commit in browser'
          )}
        </ContextMenuItem>
      ) : null}
      <ContextMenuItem onSelect={() => onAction('copy-hash', item)}>
        <Hash className="size-3.5" />
        {translate(
          'auto.components.right.sidebar.GitHistoryCommitContextMenu.8c2d5fab13',
          'Copy commit hash'
        )}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onAction('copy-message', item)}>
        <Copy className="size-3.5" />
        {translate(
          'auto.components.right.sidebar.GitHistoryCommitContextMenu.9d3e60bc24',
          'Copy commit message'
        )}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onAction('explain', item)}>
        <Sparkles className="size-3.5" />
        {translate(
          'auto.components.right.sidebar.GitHistoryCommitContextMenu.ae4f71cd35',
          'Explain changes'
        )}
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
