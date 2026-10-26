import path from 'node:path'
import { getAppEnvironment } from '../../../shared/app-environment'
import {
  isWslShellName,
  type LocalWindowsTerminalRuntimeOptions
} from '../../../shared/local-windows-terminal-runtime'
import { getWslHomeAsync, listWslDistrosAsync } from '../../wsl'

/**
 * Fork: a WSL shell asked to start at the Windows profile folder (the floating workspace's `~`)
 * starts in the distro's home like Windows Terminal, not /mnt/c/Users/<name> on the slow 9P mount.
 * Why a UNC cwd and not new shell args: the terminal daemon outlives app updates, and every daemon
 * already launches a `\\wsl.localhost\<distro>\...` cwd inside that distro.
 */
export async function resolveWslProfileHomeCwd(
  cwd: string | undefined,
  runtime: LocalWindowsTerminalRuntimeOptions
): Promise<string | undefined> {
  if (process.platform !== 'win32' || !cwd || !isWslShellName(runtime.shellOverride)) {
    return cwd
  }
  const profileDir = getAppEnvironment().getPath('home')
  if (path.win32.resolve(cwd).toLowerCase() !== path.win32.resolve(profileDir).toLowerCase()) {
    return cwd
  }
  const distro = runtime.terminalWindowsWslDistro?.trim() || (await listWslDistrosAsync())[0]
  if (!distro) {
    return cwd
  }
  // Why fall back: a distro that cannot report its home still opens, just at the old folder.
  return (await getWslHomeAsync(distro)) ?? cwd
}
