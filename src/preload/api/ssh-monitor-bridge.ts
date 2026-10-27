import { ipcRenderer } from 'electron'
import { SSH_MONITOR_CHANNELS, type SshMonitorUpdate } from '../../shared/ssh-monitor-types'
import type { PreloadApi } from '../api-types'

export const sshMonitorApi = {
  get: (): Promise<SshMonitorUpdate> => ipcRenderer.invoke(SSH_MONITOR_CHANNELS.get),
  disconnect: (paneKey: string): Promise<boolean> =>
    ipcRenderer.invoke(SSH_MONITOR_CHANNELS.disconnect, paneKey),
  serverHost: (worktreePath: string): Promise<string | null> =>
    ipcRenderer.invoke(SSH_MONITOR_CHANNELS.serverHost, worktreePath),
  onUpdate: (callback: (update: SshMonitorUpdate) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, update: SshMonitorUpdate): void =>
      callback(update)
    ipcRenderer.on(SSH_MONITOR_CHANNELS.update, listener)
    return () => ipcRenderer.removeListener(SSH_MONITOR_CHANNELS.update, listener)
  }
} satisfies PreloadApi['sshMonitor']
