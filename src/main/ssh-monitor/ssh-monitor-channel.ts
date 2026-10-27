import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { MonitorHost } from './ssh-monitor-host'
import {
  parseSshMonitorBlock,
  SSH_MONITOR_BLOCK_END,
  SSH_MONITOR_BLOCK_START,
  SSH_MONITOR_REMOTE_SCRIPT,
  type SshMonitorSnapshot
} from './ssh-monitor-stats'

export type SshMonitorChannelHandlers = {
  onSnapshot: (snapshot: SshMonitorSnapshot) => void
  /** `reason` is ssh's last stderr line, for a channel that never produced a sample. */
  onClose: (result: { sawData: boolean; reason: string }) => void
}

/** Starts `ssh … sh -s` with the stats loop on stdin and parses each block it prints. */
export function openSshMonitorChannel(
  host: MonitorHost,
  sshArgs: string[],
  handlers: SshMonitorChannelHandlers
): ChildProcessWithoutNullStreams {
  const child = host.spawn('ssh', sshArgs)
  child.stdin.on('error', () => {})
  child.stdin.end(SSH_MONITOR_REMOTE_SCRIPT)
  let stderr = ''
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2000)
  })
  let sawData = false
  let block: string[] | null = null
  createInterface({ input: child.stdout }).on('line', (line) => {
    if (line === SSH_MONITOR_BLOCK_START) {
      block = []
    } else if (line === SSH_MONITOR_BLOCK_END && block) {
      const snapshot = parseSshMonitorBlock(block)
      block = null
      if (snapshot) {
        sawData = true
        handlers.onSnapshot(snapshot)
      }
    } else if (block) {
      block.push(line)
    }
  })
  child.on('error', (error) => (stderr += `\n${error.message}`))
  child.on('close', (code) => {
    const lines = stderr.split(/\r?\n/).filter((line) => line.trim() !== '')
    const reason = lines.at(-1)?.trim() || `ssh exited with code ${code ?? 'unknown'}`
    handlers.onClose({ sawData, reason })
  })
  return child
}
