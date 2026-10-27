import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ServerLinkPrepareResult } from '../../shared/ssh-monitor-types'
import { parseWslPath } from '../wsl'
import { openServerTunnel, readServerLinks, SSH_HOST_ALIAS } from './server-links'
import { LOCAL_MONITOR_HOST, wslMonitorHost } from './ssh-monitor-host'

/** Fork: a server project is a folder whose `.ssh-host` names the host its terminals dial. */

export async function readServerHost(worktreePath: unknown): Promise<string | null> {
  if (typeof worktreePath !== 'string' || worktreePath === '') {
    return null
  }
  try {
    const firstLine = (await readFile(path.join(worktreePath, '.ssh-host'), 'utf8')).split(
      /\r?\n/
    )[0]
    const host = firstLine.trim()
    return SSH_HOST_ALIAS.test(host) ? host : null
  } catch {
    return null
  }
}

export async function prepareServerLink(
  worktreePath: unknown,
  url: unknown
): Promise<ServerLinkPrepareResult> {
  if (typeof worktreePath !== 'string' || worktreePath === '' || typeof url !== 'string') {
    return { ok: false, reason: 'invalid request' }
  }
  // Why re-read: what gets forwarded comes from the project folder, never from the renderer.
  const link = (await readServerLinks(worktreePath)).find((candidate) => candidate.url === url)
  if (!link) {
    return { ok: false, reason: '.orca-links.json no longer lists this link' }
  }
  if (!link.tunnel) {
    return { ok: true }
  }
  // Why a per-link host: a plain project can show a server's link without dialing it from its terminals.
  const sshHost = link.ssh ?? (await readServerHost(worktreePath))
  if (!sshHost) {
    return { ok: false, reason: 'the link has no "ssh" and the project no .ssh-host' }
  }
  // Why the project's distro: the user's ~/.ssh config and keys live there.
  const wsl = parseWslPath(worktreePath)
  const host =
    process.platform !== 'win32' ? LOCAL_MONITOR_HOST : wsl ? wslMonitorHost(wsl.distro) : null
  if (!host) {
    return { ok: false, reason: 'a tunnel needs a project inside WSL' }
  }
  return openServerTunnel(host, sshHost, link.tunnel)
}
