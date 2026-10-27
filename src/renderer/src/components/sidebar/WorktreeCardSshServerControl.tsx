import { useEffect, useState } from 'react'
import { Plug, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { createNewTerminalTab } from '../terminal/terminal-tab-create'
import { useSshMonitorUpdate } from '../terminal-pane/use-ssh-monitor-state'
import { PILL_BASE, PILL_QUIET } from './WorktreeCardSshHostControl'

const serverHostByPath = new Map<string, Promise<string | null>>()

function useServerHost(worktreePath: string): string | null {
  const [host, setHost] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let pending = serverHostByPath.get(worktreePath)
    if (!pending) {
      pending = window.api?.sshMonitor?.serverHost(worktreePath) ?? Promise.resolve(null)
      serverHostByPath.set(worktreePath, pending)
    }
    void pending.then((value) => {
      if (!cancelled) {
        setHost(value)
      }
    })
    return () => {
      cancelled = true
    }
  }, [worktreePath])
  return host
}

function connectServerWorkspace(worktreeId: string): void {
  const hadTabs = (useAppStore.getState().tabsByWorktree[worktreeId]?.length ?? 0) > 0
  activateAndRevealWorktree(worktreeId)
  // Why: activating a tab-less workspace already seeds a terminal; the server-project shell hook dials it.
  if (hadTabs) {
    createNewTerminalTab(worktreeId)
  }
}

type ServerControlProps = {
  worktreeId: string
  worktreePath: string
  onPointerDown: React.PointerEventHandler<HTMLButtonElement>
}

/** Fork: Connect / Disconnect on the card of a server project, a folder whose `.ssh-host` names the host. */
export function WorktreeCardSshServerControl(props: ServerControlProps): React.JSX.Element | null {
  const host = useServerHost(props.worktreePath)
  return host ? <ServerConnectPill {...props} host={host} /> : null
}

function ServerConnectPill({
  worktreeId,
  host,
  onPointerDown
}: ServerControlProps & { host: string }): React.JSX.Element {
  const tabs = useAppStore((s) => s.tabsByWorktree[worktreeId])
  const update = useSshMonitorUpdate()
  const tabIds = new Set((tabs ?? []).map((tab) => tab.id))
  const sshPaneKeys = Object.keys(update).filter((paneKey) =>
    tabIds.has(paneKey.slice(0, paneKey.indexOf(':')))
  )
  const connected = sshPaneKeys.length > 0
  const label = connected
    ? translate('auto.components.sidebar.WorktreeCardSshServerControl.4d1e7c0a92', 'Disconnect')
    : translate('auto.components.sidebar.WorktreeCardSshServerControl.9b2f5e3c17', 'Connect')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(PILL_BASE, PILL_QUIET)}
          onPointerDown={onPointerDown}
          onKeyDown={(event) => {
            // Why: the sidebar treats a bubbled Enter as "focus the terminal".
            if (event.key === 'Enter' || event.key === ' ') {
              event.stopPropagation()
            }
          }}
          onClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            if (connected) {
              for (const paneKey of sshPaneKeys) {
                void window.api.sshMonitor.disconnect(paneKey)
              }
            } else {
              connectServerWorkspace(worktreeId)
            }
          }}
        >
          {connected ? <Unplug className="size-2.5" /> : <Plug className="size-2.5" />}
          <span className="text-left">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {`ssh ${host}`}
      </TooltipContent>
    </Tooltip>
  )
}
