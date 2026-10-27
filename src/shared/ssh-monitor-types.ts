/** Fork: the MobaXterm-style monitor bar under terminals that run an interactive `ssh`. */
export const SSH_MONITOR_CHANNELS = {
  get: 'sshMonitor:get',
  update: 'sshMonitor:update',
  disconnect: 'sshMonitor:disconnect'
} as const

export type SshMonitorDisk = {
  mount: string
  usePercent: number
}

export type SshMonitorStats = {
  host: string
  user: string
  uptimeSeconds: number
  /** Null until two samples exist, since CPU and network are rates. */
  cpuPercent: number | null
  /** Oldest-first, for the sparkline. */
  cpuHistory: number[]
  memTotalBytes: number
  memUsedBytes: number
  rxBytesPerSecond: number | null
  txBytesPerSecond: number | null
  disks: SshMonitorDisk[]
}

export type SshMonitorPaneState =
  | { status: 'connecting'; destination: string }
  | { status: 'live'; destination: string; stats: SshMonitorStats }
  /** The monitor could not open its own channel; `reason` is ssh's last error line. */
  | { status: 'unavailable'; destination: string; reason: string }

/** Every pane that runs an interactive ssh right now, keyed by its ORCA_PANE_KEY. */
export type SshMonitorUpdate = Record<string, SshMonitorPaneState>

export type SshMonitorApi = {
  get: () => Promise<SshMonitorUpdate>
  onUpdate: (callback: (update: SshMonitorUpdate) => void) => () => void
  /** Ends the pane's ssh with SIGUSR1 (exit status 138), which the server-project shell reads as a hang-up. */
  disconnect: (paneKey: string) => Promise<boolean>
}
