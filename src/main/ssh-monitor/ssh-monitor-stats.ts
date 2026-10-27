import type { SshMonitorDisk, SshMonitorStats } from '../../shared/ssh-monitor-types'

export const SSH_MONITOR_BLOCK_START = '@@orca-ssh-monitor'
export const SSH_MONITOR_BLOCK_END = '@@end'
const DF_MARKER = '@@df'
const CPU_HISTORY_LENGTH = 40

/**
 * Runs on the server through `sh -s`: plain POSIX sh and /proc, nothing to install.
 * Why the loop lives remotely: one channel stays open instead of a new exec every tick.
 */
export const SSH_MONITOR_REMOTE_SCRIPT = `h=$(hostname -f 2>/dev/null || hostname 2>/dev/null || cat /proc/sys/kernel/hostname)
u=$(id -un 2>/dev/null || whoami)
while :; do
  printf '%s\\n' '${SSH_MONITOR_BLOCK_START}' "host $h" "user $u"
  printf 'uptime %s\\n' "$(cut -d' ' -f1 /proc/uptime)"
  head -n1 /proc/stat
  grep -E '^(MemTotal|MemAvailable|MemFree|Buffers|Cached):' /proc/meminfo
  tail -n +3 /proc/net/dev
  printf '%s\\n' '${DF_MARKER}'
  df -P -k -x tmpfs -x devtmpfs -x squashfs -x overlay -x efivarfs 2>/dev/null | tail -n +2
  printf '%s\\n' '${SSH_MONITOR_BLOCK_END}'
  sleep 2
done
`

export type SshMonitorSnapshot = {
  host: string
  user: string
  uptimeSeconds: number
  cpuTotal: number
  cpuIdle: number
  memTotalBytes: number
  memAvailableBytes: number
  rxBytes: number
  txBytes: number
  disks: SshMonitorDisk[]
}

// Why skip these: container bridges and veth pairs repeat traffic the real NIC already counted.
const VIRTUAL_INTERFACE =
  /^(lo|veth|docker|br-|virbr|cni|flannel|cali|vxlan|kube|tunl|weave|podman|lxc|lxd)/

/** Parses the lines between the block markers, or returns null when the block is unusable. */
export function parseSshMonitorBlock(lines: readonly string[]): SshMonitorSnapshot | null {
  let host = ''
  let user = ''
  let uptimeSeconds = Number.NaN
  let cpuTotal = Number.NaN
  let cpuIdle = Number.NaN
  const memory = new Map<string, number>()
  let rxBytes = 0
  let txBytes = 0
  const disks: SshMonitorDisk[] = []
  let inDf = false
  for (const line of lines) {
    if (line === DF_MARKER) {
      inDf = true
      continue
    }
    if (inDf) {
      const disk = parseDfLine(line)
      if (disk && !disks.some((existing) => existing.mount === disk.mount)) {
        disks.push(disk)
      }
      continue
    }
    if (line.startsWith('host ')) {
      host = line.slice(5).trim()
    } else if (line.startsWith('user ')) {
      user = line.slice(5).trim()
    } else if (line.startsWith('uptime ')) {
      uptimeSeconds = Number(line.slice(7))
    } else if (/^cpu\s/.test(line)) {
      // user nice system idle iowait irq softirq steal; guest time is already inside user/nice.
      const fields = line.trim().split(/\s+/).slice(1, 9).map(Number)
      cpuTotal = fields.reduce((sum, value) => sum + value, 0)
      cpuIdle = (fields[3] ?? 0) + (fields[4] ?? 0)
    } else if (/^[A-Za-z]+:\s+\d+ kB$/.test(line)) {
      const [name, value] = line.split(/:\s+/)
      memory.set(name, Number.parseInt(value, 10) * 1024)
    } else if (line.includes(':')) {
      const separator = line.indexOf(':')
      const name = line.slice(0, separator).trim()
      const counters = line
        .slice(separator + 1)
        .trim()
        .split(/\s+/)
        .map(Number)
      if (!VIRTUAL_INTERFACE.test(name) && counters.length >= 9) {
        rxBytes += counters[0]
        txBytes += counters[8]
      }
    }
  }
  const memTotalBytes = memory.get('MemTotal')
  // Why the fallback: kernels before 3.14 have no MemAvailable.
  const memAvailableBytes =
    memory.get('MemAvailable') ??
    (memory.get('MemFree') ?? 0) + (memory.get('Buffers') ?? 0) + (memory.get('Cached') ?? 0)
  if (!memTotalBytes || !Number.isFinite(cpuTotal) || !Number.isFinite(uptimeSeconds)) {
    return null
  }
  disks.sort((a, b) =>
    a.mount === '/' ? -1 : b.mount === '/' ? 1 : a.mount.localeCompare(b.mount)
  )
  return {
    host,
    user,
    uptimeSeconds,
    cpuTotal,
    cpuIdle,
    memTotalBytes,
    memAvailableBytes,
    rxBytes,
    txBytes,
    disks
  }
}

function parseDfLine(line: string): SshMonitorDisk | null {
  // Filesystem 1024-blocks Used Available Capacity Mounted-on; the mount may contain spaces.
  const fields = line.trim().split(/\s+/)
  if (fields.length < 6) {
    return null
  }
  const usePercent = Number.parseInt(fields[4], 10)
  const mount = fields.slice(5).join(' ')
  if (!Number.isFinite(usePercent) || mount.startsWith('/snap/')) {
    return null
  }
  return { mount, usePercent }
}

/** Rates come from the server's own uptime clock, so a slow channel cannot inflate them. */
export function computeSshMonitorStats(
  previous: SshMonitorSnapshot | undefined,
  next: SshMonitorSnapshot,
  previousHistory: readonly number[]
): SshMonitorStats {
  const elapsed = previous ? next.uptimeSeconds - previous.uptimeSeconds : 0
  // Why the guard: a reboot or a reconnect to another host resets every counter.
  const comparable = previous !== undefined && elapsed > 0 && next.cpuTotal >= previous.cpuTotal
  let cpuPercent: number | null = null
  let rxBytesPerSecond: number | null = null
  let txBytesPerSecond: number | null = null
  if (comparable) {
    const totalDelta = next.cpuTotal - previous.cpuTotal
    const idleDelta = next.cpuIdle - previous.cpuIdle
    cpuPercent = totalDelta > 0 ? clampPercent(((totalDelta - idleDelta) / totalDelta) * 100) : 0
    rxBytesPerSecond = Math.max(0, (next.rxBytes - previous.rxBytes) / elapsed)
    txBytesPerSecond = Math.max(0, (next.txBytes - previous.txBytes) / elapsed)
  }
  const cpuHistory =
    cpuPercent === null
      ? [...previousHistory]
      : [...previousHistory, cpuPercent].slice(-CPU_HISTORY_LENGTH)
  return {
    host: next.host,
    user: next.user,
    uptimeSeconds: next.uptimeSeconds,
    cpuPercent,
    cpuHistory,
    memTotalBytes: next.memTotalBytes,
    memUsedBytes: Math.max(0, next.memTotalBytes - next.memAvailableBytes),
    rxBytesPerSecond,
    txBytesPerSecond,
    disks: next.disks
  }
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}
