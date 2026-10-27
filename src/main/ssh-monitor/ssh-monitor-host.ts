import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { resolveWslInteropSpawnCwd } from '../wsl-interop-spawn-directory'

const PROBE_TIMEOUT_MS = 8_000

/** Where the terminals run: one WSL distro on Windows, or this machine on Linux. */
export type MonitorHost = {
  key: string
  spawn: (program: string, args: string[]) => ChildProcessWithoutNullStreams
}

export function wslMonitorHost(distro: string): MonitorHost {
  return {
    key: `wsl:${distro}`,
    spawn: (program, args) =>
      spawn('wsl.exe', ['-d', distro, '--exec', program, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        // Why explicit (#16463): an inherited cwd can be a deleted worktree.
        cwd: resolveWslInteropSpawnCwd()
      })
  }
}

export const LOCAL_MONITOR_HOST: MonitorHost = {
  key: 'local',
  spawn: (program, args) => spawn(program, args, { stdio: ['pipe', 'pipe', 'pipe'] })
}

export function runOnMonitorHost(
  host: MonitorHost,
  program: string,
  args: string[],
  timeoutMs = PROBE_TIMEOUT_MS
): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve) => {
    let stdout = ''
    let child: ChildProcessWithoutNullStreams
    try {
      child = host.spawn(program, args)
    } catch {
      resolve({ code: null, stdout })
      return
    }
    const timer = setTimeout(() => child.kill(), timeoutMs)
    child.stdin.end()
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr.resume()
    child.on('error', () => {})
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout })
    })
  })
}
