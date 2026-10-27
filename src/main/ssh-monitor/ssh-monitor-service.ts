import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { app, ipcMain } from 'electron'
import {
  SSH_MONITOR_CHANNELS,
  type SshMonitorPaneState,
  type SshMonitorUpdate
} from '../../shared/ssh-monitor-types'
import { sendToTrustedUIRenderer } from '../ipc/ui'
import { listConfirmedRunningWslDistros } from '../wsl-background-distro-gate'
import {
  buildSshMonitorArgs,
  buildSshMonitorTarget,
  parseSshMonitorMode,
  type SshMonitorMode,
  type SshMonitorTarget
} from './ssh-monitor-argv'
import { openSshMonitorChannel } from './ssh-monitor-channel'
import {
  LOCAL_MONITOR_HOST,
  runOnMonitorHost,
  wslMonitorHost,
  type MonitorHost
} from './ssh-monitor-host'
import { startSshScanner, type ScannedSshSession, type SshScanner } from './ssh-monitor-scan'
import { computeSshMonitorStats, type SshMonitorSnapshot } from './ssh-monitor-stats'

const HOST_RECONCILE_MS = 30_000
const MASTER_POLL_MS = 3_000
const RECONNECT_MS = 5_000

type Session = {
  host: MonitorHost
  pid: number
  target: SshMonitorTarget
  mode: SshMonitorMode | null
  directTried: boolean
  child: ChildProcessWithoutNullStreams | null
  timer: NodeJS.Timeout | null
  state: SshMonitorPaneState
  previous: SshMonitorSnapshot | undefined
  history: number[]
  disposed: boolean
}

type HostScanner = {
  host: MonitorHost
  scanner: SshScanner
}

class SshMonitorService {
  private readonly scanners = new Map<string, HostScanner>()
  private readonly sessions = new Map<string, Session>()
  private reconcileTimer: NodeJS.Timeout | null = null
  private emitTimer: NodeJS.Timeout | null = null
  private lastSent = '{}'
  private disposed = false

  start(): void {
    if (process.platform === 'linux') {
      this.ensureScanner(LOCAL_MONITOR_HOST)
    } else if (process.platform === 'win32') {
      void this.reconcileWslHosts()
      this.reconcileTimer = setInterval(() => void this.reconcileWslHosts(), HOST_RECONCILE_MS)
    }
  }

  snapshot(): SshMonitorUpdate {
    const update: SshMonitorUpdate = {}
    for (const [paneKey, session] of this.sessions) {
      update[paneKey] = session.state
    }
    return update
  }

  async disconnect(paneKey: string): Promise<boolean> {
    const session = this.sessions.get(paneKey)
    if (!session) {
      return false
    }
    // Why check comm: the pid came from a scan up to 2 s ago and may have been reused since.
    const result = await runOnMonitorHost(session.host, 'sh', [
      '-c',
      '[ "$(cat /proc/$1/comm 2>/dev/null)" = ssh ] && kill -USR1 "$1"',
      'sh',
      String(session.pid)
    ])
    return result.code === 0
  }

  dispose(): void {
    this.disposed = true
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer)
    }
    for (const scanner of this.scanners.values()) {
      this.stopScanner(scanner)
    }
  }

  // Why only running distros: scanning a stopped one would boot it.
  private async reconcileWslHosts(): Promise<void> {
    const distros = await listConfirmedRunningWslDistros()
    if (this.disposed) {
      return
    }
    const wanted = new Set(distros.map((distro) => `wsl:${distro}`))
    for (const scanner of this.scanners.values()) {
      if (!wanted.has(scanner.host.key)) {
        this.stopScanner(scanner)
      }
    }
    for (const distro of distros) {
      this.ensureScanner(wslMonitorHost(distro))
    }
  }

  private ensureScanner(host: MonitorHost): void {
    if (!this.scanners.has(host.key)) {
      const scanner = startSshScanner(host, (scanned) => this.applyScan(host, scanned))
      this.scanners.set(host.key, { host, scanner })
    }
  }

  private stopScanner({ host, scanner }: HostScanner): void {
    this.scanners.delete(host.key)
    scanner.stop()
    this.applyScan(host, new Map())
  }

  private applyScan(host: MonitorHost, scanned: Map<string, ScannedSshSession>): void {
    for (const [paneKey, session] of this.sessions) {
      if (session.host.key === host.key && scanned.get(paneKey)?.pid !== session.pid) {
        this.disposeSession(paneKey, session)
      }
    }
    for (const [paneKey, { pid, argv }] of scanned) {
      if (this.disposed || this.sessions.has(paneKey)) {
        continue
      }
      const target = buildSshMonitorTarget(argv)
      if (!target) {
        continue
      }
      const session: Session = {
        host,
        pid,
        target,
        mode: null,
        directTried: false,
        child: null,
        timer: null,
        state: { status: 'connecting', destination: target.destination },
        previous: undefined,
        history: [],
        disposed: false
      }
      this.sessions.set(paneKey, session)
      void this.advance(session)
    }
    this.scheduleEmit()
  }

  private disposeSession(paneKey: string, session: Session): void {
    session.disposed = true
    this.sessions.delete(paneKey)
    if (session.timer) {
      clearTimeout(session.timer)
    }
    session.child?.kill()
    session.child = null
  }

  private retryLater(session: Session, delayMs: number): void {
    if (session.disposed) {
      return
    }
    session.timer = setTimeout(() => {
      session.timer = null
      void this.advance(session)
    }, delayMs)
  }

  private setState(session: Session, state: SshMonitorPaneState): void {
    session.state = state
    this.scheduleEmit()
  }

  private async advance(session: Session): Promise<void> {
    const { host, target } = session
    if (session.mode === null) {
      const resolved = await runOnMonitorHost(host, 'ssh', ['-G', ...target.connectArgs])
      if (session.disposed) {
        return
      }
      session.mode = parseSshMonitorMode(resolved.stdout)
    }
    if (session.mode === 'mux') {
      // Why wait: until the user's own ssh has logged in there is no master to ride.
      const check = await runOnMonitorHost(host, 'ssh', ['-O', 'check', ...target.connectArgs])
      if (session.disposed) {
        return
      }
      if (check.code !== 0) {
        this.retryLater(session, MASTER_POLL_MS)
        return
      }
    } else if (session.directTried) {
      return
    } else {
      // Why once: repeated failed logins are what fail2ban bans.
      session.directTried = true
    }
    this.launchMonitor(session, session.mode)
  }

  private launchMonitor(session: Session, mode: SshMonitorMode): void {
    const { destination } = session.target
    let child: ChildProcessWithoutNullStreams
    try {
      child = openSshMonitorChannel(session.host, buildSshMonitorArgs(session.target, mode), {
        onSnapshot: (snapshot) => {
          if (session.disposed) {
            return
          }
          const stats = computeSshMonitorStats(session.previous, snapshot, session.history)
          session.previous = snapshot
          session.history = stats.cpuHistory
          // A key that worked once may retry after a network drop.
          session.directTried = false
          this.setState(session, { status: 'live', destination, stats })
        },
        onClose: ({ sawData, reason }) => {
          if (session.child !== child) {
            return
          }
          session.child = null
          session.previous = undefined
          if (session.disposed) {
            return
          }
          this.setState(
            session,
            sawData
              ? { status: 'connecting', destination }
              : { status: 'unavailable', destination, reason }
          )
          this.retryLater(session, RECONNECT_MS)
        }
      })
    } catch (error) {
      this.setState(session, { status: 'unavailable', destination, reason: String(error) })
      return
    }
    session.child = child
  }

  private scheduleEmit(): void {
    if (this.emitTimer || this.disposed) {
      return
    }
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null
      const update = this.snapshot()
      const serialized = JSON.stringify(update)
      if (serialized !== this.lastSent) {
        this.lastSent = serialized
        sendToTrustedUIRenderer(SSH_MONITOR_CHANNELS.update, update)
      }
    }, 50)
  }
}

let service: SshMonitorService | null = null

/** Fork: starts the SSH monitor once per app run; its processes end with the app. */
export function startSshMonitorService(): void {
  if (service) {
    return
  }
  service = new SshMonitorService()
  // Why a getter: a reloaded window would otherwise wait for the next change to see the bars.
  ipcMain.handle(SSH_MONITOR_CHANNELS.get, () => service?.snapshot() ?? {})
  ipcMain.handle(SSH_MONITOR_CHANNELS.disconnect, (_event, paneKey: unknown) =>
    typeof paneKey === 'string' ? (service?.disconnect(paneKey) ?? false) : false
  )
  app.on('will-quit', () => service?.dispose())
  service.start()
}
