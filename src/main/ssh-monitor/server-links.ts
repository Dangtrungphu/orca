import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ServerLinkPrepareResult, ServerProjectLink } from '../../shared/ssh-monitor-types'
import { runOnMonitorHost, type MonitorHost } from './ssh-monitor-host'

const TUNNEL_SPEC = /^(\d{1,5}):([\w.-]+):(\d{1,5})$/
export const SSH_HOST_ALIAS = /^[\w.@:-]+$/
const TUNNEL_TIMEOUT_MS = 20_000

/**
 * Starts `ssh -f -N -L` unless the local port already listens. Why -f: ssh backgrounds itself once
 * the forward is bound, so its exit status is the answer and the tunnel outlives this call.
 * Why the agent files: the oh-my-zsh ssh-agent plugin leaves its socket there for keys with a
 * passphrase, and `wsl.exe --exec` runs no login shell that would load it.
 * Why the temp file: the backgrounded ssh keeps its stderr, which must not be our pipe.
 */
const TUNNEL_SCRIPT = `
if ss -Hltn "sport = :$1" 2>/dev/null | grep -q .; then exit 0; fi
for f in "$HOME"/.ssh/environment-*; do [ -r "$f" ] && . "$f" >/dev/null; done
err=$(mktemp)
ssh -f -N -n -o BatchMode=yes -o ExitOnForwardFailure=yes -o ControlMaster=no -o ControlPath=none \\
  -o ConnectTimeout=10 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \\
  -L "127.0.0.1:$2" -- "$3" >/dev/null 2>"$err"
rc=$?
tail -n 1 "$err"
rm -f "$err"
exit $rc
`

function isTunnelSpec(spec: string): boolean {
  const match = TUNNEL_SPEC.exec(spec)
  return Boolean(
    match && [match[1], match[3]].every((port) => Number(port) >= 1 && Number(port) <= 65535)
  )
}

/** `[{"label", "url", "tunnel"?, "ssh"?}]`; an entry that does not fit is skipped, not fatal. */
export function parseServerLinks(raw: string): ServerProjectLink[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) {
    return []
  }
  const links: ServerProjectLink[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const { label, url, tunnel, ssh } = entry as Record<string, unknown>
    if (typeof label !== 'string' || label.trim() === '') {
      continue
    }
    if (typeof url !== 'string' || !/^https?:\/\/\S+$/i.test(url)) {
      continue
    }
    if (tunnel !== undefined && (typeof tunnel !== 'string' || !isTunnelSpec(tunnel))) {
      continue
    }
    if (ssh !== undefined && (typeof ssh !== 'string' || !SSH_HOST_ALIAS.test(ssh))) {
      continue
    }
    links.push({ label: label.trim(), url, tunnel: tunnel ?? null, ssh: ssh ?? null })
  }
  return links
}

export async function readServerLinks(worktreePath: string): Promise<ServerProjectLink[]> {
  try {
    return parseServerLinks(await readFile(path.join(worktreePath, '.orca-links.json'), 'utf8'))
  } catch {
    return []
  }
}

export async function openServerTunnel(
  host: MonitorHost,
  sshHost: string,
  spec: string
): Promise<ServerLinkPrepareResult> {
  const localPort = spec.slice(0, spec.indexOf(':'))
  const result = await runOnMonitorHost(
    host,
    'sh',
    ['-c', TUNNEL_SCRIPT, 'sh', localPort, spec, sshHost],
    TUNNEL_TIMEOUT_MS
  )
  if (result.code === 0) {
    return { ok: true }
  }
  const lines = result.stdout.split(/\r?\n/).filter((line) => line.trim() !== '')
  return {
    ok: false,
    reason: lines.at(-1)?.trim() || `ssh exited with code ${result.code ?? 'unknown'}`
  }
}
