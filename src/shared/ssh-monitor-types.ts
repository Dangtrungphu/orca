/** Fork: the MobaXterm-style monitor bar under terminals that run an interactive `ssh`. */
export const SSH_MONITOR_CHANNELS = {
  get: 'sshMonitor:get',
  update: 'sshMonitor:update',
  disconnect: 'sshMonitor:disconnect',
  serverHost: 'sshMonitor:serverHost',
  serverLinks: 'sshMonitor:serverLinks',
  prepareServerLink: 'sshMonitor:prepareServerLink'
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

/** A link on a server project's card, declared in `.orca-links.json` next to `.ssh-host`. */
export type ServerProjectLink = {
  label: string
  url: string
  /** `localPort:host:hostPort`, forwarded over ssh to the project's host before the link opens. */
  tunnel: string | null
  /** The ssh host the tunnel goes through; null means the project's `.ssh-host`. */
  ssh: string | null
}

export type ServerLinkPrepareResult = { ok: true } | { ok: false; reason: string }

/** Every pane that runs an interactive ssh right now, keyed by its ORCA_PANE_KEY. */
export type SshMonitorUpdate = Record<string, SshMonitorPaneState>

export type SshMonitorApi = {
  get: () => Promise<SshMonitorUpdate>
  onUpdate: (callback: (update: SshMonitorUpdate) => void) => () => void
  /** Ends the pane's ssh with SIGUSR1 (exit status 138), which the server-project shell reads as a hang-up. */
  disconnect: (paneKey: string) => Promise<boolean>
  /** The ssh host a server project connects to: the first line of `.ssh-host` in its folder, or null. */
  serverHost: (worktreePath: string) => Promise<string | null>
  /** The links a server project shows on its card; empty when its folder has no `.orca-links.json`. */
  serverLinks: (worktreePath: string) => Promise<ServerProjectLink[]>
  /** Opens the tunnel of the project's link with this URL, if it has one, so the URL answers here. */
  prepareServerLink: (worktreePath: string, url: string) => Promise<ServerLinkPrepareResult>
}
