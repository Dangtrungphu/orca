import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { activateBrowserWorkspaceTab } from '@/lib/browser-workspace-tab-activation'
import { openWorkspaceBrowserTab } from '@/lib/workspace-browser-tab-open'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { ServerProjectLink } from '../../../../shared/ssh-monitor-types'

const linksByPath = new Map<string, Promise<ServerProjectLink[]>>()

function useServerLinks(worktreePath: string): ServerProjectLink[] {
  const [links, setLinks] = useState<ServerProjectLink[]>([])
  useEffect(() => {
    let cancelled = false
    let pending = linksByPath.get(worktreePath)
    if (!pending) {
      pending = window.api?.sshMonitor?.serverLinks(worktreePath) ?? Promise.resolve([])
      linksByPath.set(worktreePath, pending)
    }
    void pending.then((value) => {
      if (!cancelled) {
        setLinks(value)
      }
    })
    return () => {
      cancelled = true
    }
  }, [worktreePath])
  return links
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin
  } catch {
    return false
  }
}

async function openServerLink(
  worktreeId: string,
  worktreePath: string,
  link: ServerProjectLink
): Promise<void> {
  // Why providesInitialSurface: a seeded terminal in a server project would dial the host.
  activateAndRevealWorktree(worktreeId, { providesInitialSurface: true })
  const prepared = await window.api.sshMonitor.prepareServerLink(worktreePath, link.url)
  if (!prepared.ok) {
    toast.error(
      translate(
        'auto.components.sidebar.WorktreeCardServerLinks.6f3a9d21c4',
        'Could not open {{value0}}: {{value1}}',
        { value0: link.label, value1: prepared.reason }
      )
    )
    return
  }
  // Why by origin: the page may have moved on to another view of the same server.
  const existing = useAppStore
    .getState()
    .browserTabsByWorktree[worktreeId]?.find((tab) => sameOrigin(tab.url, link.url))
  if (existing && activateBrowserWorkspaceTab({ worktreeId, workspaceId: existing.id })) {
    return
  }
  await openWorkspaceBrowserTab({ workspaceId: worktreeId, url: link.url, intent: { kind: 'url' } })
}

const stopBubble = (event: React.SyntheticEvent): void => event.stopPropagation()

type Props = {
  worktreeId: string
  worktreePath: string
}

/** Fork: a row per link in a server project's `.orca-links.json`, opened in a browser tab. */
export function WorktreeCardServerLinks({
  worktreeId,
  worktreePath
}: Props): React.JSX.Element | null {
  const links = useServerLinks(worktreePath)
  const [openingUrl, setOpeningUrl] = useState<string | null>(null)
  if (links.length === 0) {
    return null
  }
  const open = (link: ServerProjectLink): void => {
    if (openingUrl) {
      return
    }
    setOpeningUrl(link.url)
    openServerLink(worktreeId, worktreePath, link)
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : String(error))
      })
      .finally(() => setOpeningUrl(null))
  }
  return (
    <div
      className="flex flex-col mt-1 gap-0.5"
      onClick={stopBubble}
      onDoubleClick={stopBubble}
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
    >
      {links.map((link) => (
        <button
          key={link.url}
          type="button"
          title={link.url}
          className={cn(
            '-ml-2 flex items-center gap-1.5 px-2 py-1 text-left',
            'cursor-pointer rounded-sm worktree-agent-row-hover text-[11px] text-muted-foreground',
            openingUrl === link.url && 'cursor-progress opacity-75'
          )}
          onKeyDown={(event) => {
            // Why: the sidebar treats a bubbled Enter as "focus the terminal".
            if (event.key === 'Enter' || event.key === ' ') {
              event.stopPropagation()
            }
          }}
          onClick={() => open(link)}
        >
          <Activity className="size-3 shrink-0" />
          <span className="min-w-0 truncate">{link.label}</span>
        </button>
      ))}
    </div>
  )
}
