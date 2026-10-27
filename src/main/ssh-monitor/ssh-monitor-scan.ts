import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { MonitorHost } from './ssh-monitor-host'

const ARG_SEPARATOR = '\x1f'
const SCAN_TICK = 'tick'
const SCANNER_RESTART_MS = 10_000

/**
 * Runs where the terminals live (inside WSL on Windows) and reports, every 2 s, each `ssh` whose
 * stdin is a terminal and whose environment carries an Orca pane key.
 * Why stdin: git, scp and rsync run ssh over pipes, and a ControlPersist master detaches to /dev/null.
 */
export const SSH_MONITOR_SCAN_SCRIPT = `while :; do
  for p in $(pgrep -x ssh 2>/dev/null); do
    case "$(readlink /proc/$p/fd/0 2>/dev/null)" in /dev/pts/*) ;; *) continue ;; esac
    k=$(tr '\\0' '\\n' < /proc/$p/environ 2>/dev/null | sed -n 's/^ORCA_PANE_KEY=//p')
    [ -n "$k" ] || continue
    printf 'ssh\\t%s\\t%s\\t%s\\n' "$p" "$k" "$(tr '\\0' '\\037' < /proc/$p/cmdline 2>/dev/null)"
  done
  echo ${SCAN_TICK}
  sleep 2
done
`

export type ScannedSshSession = {
  pid: number
  argv: string[]
}

/** One tick's `ssh` lines, newest process per pane. */
export function parseSshScanLines(lines: readonly string[]): Map<string, ScannedSshSession> {
  const sessions = new Map<string, ScannedSshSession>()
  for (const line of lines) {
    const [kind, pidText, paneKey, cmdline] = line.split('\t')
    const pid = Number(pidText)
    if (kind !== 'ssh' || !paneKey || !cmdline || !Number.isInteger(pid)) {
      continue
    }
    const argv = cmdline.split(ARG_SEPARATOR).filter((arg, index, all) => {
      // Why: /proc cmdline ends with a NUL, which leaves one empty trailing field.
      return arg !== '' || index < all.length - 1
    })
    const current = sessions.get(paneKey)
    if (!current || pid > current.pid) {
      sessions.set(paneKey, { pid, argv })
    }
  }
  return sessions
}

export type SshScanner = { stop: () => void }

/** Keeps one scan loop running on `host`, restarting it if it dies, until stopped. */
export function startSshScanner(
  host: MonitorHost,
  onScan: (sessions: Map<string, ScannedSshSession>) => void
): SshScanner {
  let stopped = false
  let child: ChildProcessWithoutNullStreams | null = null
  let restartTimer: NodeJS.Timeout | null = null
  const launch = (): void => {
    restartTimer = null
    let current: ChildProcessWithoutNullStreams
    try {
      current = host.spawn('sh', ['-s'])
    } catch {
      restartTimer = setTimeout(launch, SCANNER_RESTART_MS)
      return
    }
    child = current
    current.stdin.on('error', () => {})
    current.stdin.end(SSH_MONITOR_SCAN_SCRIPT)
    current.stderr.resume()
    let pending: string[] = []
    createInterface({ input: current.stdout }).on('line', (line) => {
      if (line !== SCAN_TICK) {
        pending.push(line)
        return
      }
      onScan(parseSshScanLines(pending))
      pending = []
    })
    current.on('error', () => {})
    current.on('close', () => {
      if (stopped || child !== current) {
        return
      }
      child = null
      onScan(new Map())
      restartTimer = setTimeout(launch, SCANNER_RESTART_MS)
    })
  }
  launch()
  return {
    stop: () => {
      stopped = true
      if (restartTimer) {
        clearTimeout(restartTimer)
      }
      child?.kill()
      child = null
    }
  }
}
