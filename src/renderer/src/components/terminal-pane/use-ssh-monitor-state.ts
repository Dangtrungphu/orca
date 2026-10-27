import { useSyncExternalStore } from 'react'
import type { SshMonitorPaneState, SshMonitorUpdate } from '../../../../shared/ssh-monitor-types'

let current: SshMonitorUpdate = {}
const listeners = new Set<() => void>()
let unsubscribeMain: (() => void) | null = null

function publish(update: SshMonitorUpdate): void {
  current = update
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Why optional: test doubles of window.api carry no sshMonitor bridge.
  const api = window.api?.sshMonitor
  if (api && !unsubscribeMain) {
    // Why one subscription: every pane reads the same map, and main pushes it whole.
    unsubscribeMain = api.onUpdate(publish)
    void api
      .get()
      .then(publish)
      .catch(() => {})
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      unsubscribeMain?.()
      unsubscribeMain = null
    }
  }
}

/** Fork: what the SSH monitor knows about the ssh running in this pane, if any. */
export function useSshMonitorPaneState(paneKey: string): SshMonitorPaneState | undefined {
  return useSyncExternalStore(
    subscribe,
    () => current[paneKey],
    () => undefined
  )
}

/** Fork: every pane's SSH monitor state, for UI that summarizes a workspace. */
export function useSshMonitorUpdate(): SshMonitorUpdate {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current
  )
}
