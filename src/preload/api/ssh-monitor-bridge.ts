import { ipcRenderer } from 'electron'
import {
  SSH_MONITOR_CHANNELS,
  type ServerLinkPrepareResult,
  type ServerProjectLink,
  type SshMonitorUpdate
} from '../../shared/ssh-monitor-types'
import type { PreloadApi } from '../api-types'

export const sshMonitorApi = {
  get: (): Promise<SshMonitorUpdate> => ipcRenderer.invoke(SSH_MONITOR_CHANNELS.get),
  disconnect: (paneKey: string): Promise<boolean> =>
    ipcRenderer.invoke(SSH_MONITOR_CHANNELS.disconnect, paneKey),
  serverHost: (worktreePath: string): Promise<string | null> =>
    ipcRenderer.invoke(SSH_MONITOR_CHANNELS.serverHost, worktreePath),
  serverLinks: (worktreePath: string): Promise<ServerProjectLink[]> =>
    ipcRenderer.invoke(SSH_MONITOR_CHANNELS.serverLinks, worktreePath),
  prepareServerLink: (worktreePath: string, url: string): Promise<ServerLinkPrepareResult> =>
    ipcRenderer.invoke(SSH_MONITOR_CHANNELS.prepareServerLink, worktreePath, url),
  onUpdate: (callback: (update: SshMonitorUpdate) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, update: SshMonitorUpdate): void =>
      callback(update)
    ipcRenderer.on(SSH_MONITOR_CHANNELS.update, listener)
    return () => ipcRenderer.removeListener(SSH_MONITOR_CHANNELS.update, listener)
  }
} satisfies PreloadApi['sshMonitor']
